import { strict as assert } from "node:assert";
import { test, mock } from "node:test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import express from "express";
import { clerkClient } from "@clerk/express";
import { db, pool, lktEditors, lktOperators, lktEditorialAccessEvents, lktEditorialEvents } from "@workspace/db";
import { eq } from "drizzle-orm";
import router from "../routes/lkt-operators";
import { requireLktAccount } from "./lkt-auth";
import { changeEditorialAccess } from "./lkt-operator-access";
import { LktAccessError } from "./lkt-ai-limits";
import { GetOperatorStatusResponse, GetEditorialAccessResponse, GrantEditorialAccessResponse } from "@workspace/api-zod";

test("operator-only access management, atomic audit, revocation and attribution", async () => {
  const schema = `operator_test_${randomUUID().replaceAll("-", "")}`;
  const connection = await pool.connect();
  await connection.query(`CREATE SCHEMA "${schema}"`);
  await connection.query(`SET search_path TO "${schema}"`);
  const setSchema = (client: { query: (query: string) => unknown }) => { void client.query(`SET search_path TO "${schema}"`); };
  pool.on("connect", setSchema);
  for (const name of ["lkt-editorial", "lkt-operators"]) {
    await connection.query(await readFile(new URL(`../../../../lib/db/migrations/${name}.sql`, import.meta.url), "utf8"));
  }
  connection.release();
  const lookup = mock.method(clerkClient.users, "getUserList", async ({ emailAddress }: { emailAddress: string[] }) => ({
    data: emailAddress[0] === "editor@example.test" ? [{
      id: "target", emailAddresses: [{ emailAddress: "editor@example.test", verification: { status: "verified" } }],
    }] : [],
  }));
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    Object.assign(req, { auth: Object.assign(
      () => ({ userId: req.get("test-user") ?? null, tokenType: "session_token" }),
      { [Symbol.for("@clerk/express.auth")]: true },
    ) }); next();
  });
  app.use(requireLktAccount, router);
  app.use(((err, _req, res, _next) => {
    res.status(err instanceof LktAccessError ? err.status : 500).json({ error: err.message });
  }) as express.ErrorRequestHandler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.on("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const call = async (path: string, user?: string, body?: unknown, origin?: string) => {
    const response = await fetch(`http://127.0.0.1:${address.port}/lkt/operator${path}`, {
      method: body ? "POST" : "GET",
      headers: { ...(user ? { "test-user": user } : {}), "Content-Type": "application/json", ...(origin ? { origin } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, data: await response.json() };
  };
  const grant = { email: "editor@example.test", displayName: "Editor Target", reason: "Penugasan tinjau" };
  const revoke = { userId: "target", reason: "Penugasan selesai" };
  try {
    assert.equal((await call("/editorial-access")).status, 401);
    await db.insert(lktEditors).values({ userId: "editor-only", displayName: "Editor only" });
    for (const user of ["first-account", "company-owner", "company-member", "editor-only"]) {
      assert.deepEqual((await call("", user)).data, { canManageEditors: false });
      assert.equal((await call("/editorial-access", user)).status, 403);
      assert.equal((await call("/editorial-access", user, grant)).status, 403);
      assert.equal((await call("/editorial-access/revoke", user, revoke)).status, 403);
    }
    await changeEditorialAccess({ source: "cli", operatorName: "Infrastructure human" }, {
      role: "operator", action: "grant", targetUserId: "operator", displayName: "Operator Human", reason: "Bootstrap explicit",
    });
    assert.equal(GetOperatorStatusResponse.parse((await call("", "operator")).data).canManageEditors, true);
    assert.equal((await db.select().from(lktEditors).where(eq(lktEditors.userId, "operator"))).length, 0);
    assert.equal((await call("/editorial-access", "operator", grant, "https://evil.example")).status, 403);
    for (const body of [{ ...grant, reason: " " }, { ...grant, actorId: "spoof" }, { ...grant, role: "operator" }, { ...grant, email: "missing@example.test" }]) {
      assert.equal((await call("/editorial-access", "operator", body)).status, 400);
    }
    const grants = await Promise.all([call("/editorial-access", "operator", grant), call("/editorial-access", "operator", grant)]);
    assert.deepEqual(grants.map(r => GrantEditorialAccessResponse.parse(r.data).changed).sort(), [false, true]);
    assert.ok(grants.every(r => r.status === 200));
    await db.insert(lktEditorialEvents).values({ referenceId: "historical", snapshot: { actorUserId: "target", actorName: "Editor Target" } });
    const history = await db.select().from(lktEditorialEvents);
    assert.equal(GrantEditorialAccessResponse.parse((await call("/editorial-access/revoke", "operator", revoke)).data).changed, true);
    assert.equal(GrantEditorialAccessResponse.parse((await call("/editorial-access/revoke", "operator", revoke)).data).changed, false);
    assert.deepEqual(await db.select().from(lktEditorialEvents), history);
    const audit = GetEditorialAccessResponse.parse((await call("/editorial-access", "operator")).data).events;
    assert.deepEqual(audit.map((e: { action: string }) => e.action), ["revoke", "grant", "grant"]);
    assert.equal(audit[0].actorId, "operator");
    assert.equal(audit[0].targetName, "Editor Target");
    assert.equal(audit[0].reason, revoke.reason);
    for (const command of ["UPDATE lkt_editorial_access_events SET reason='rewrite'", "DELETE FROM lkt_editorial_access_events", "TRUNCATE lkt_editorial_access_events"]) {
      await assert.rejects(pool.query(command), /append-only/);
    }
    // A failed audit write must roll back the grant too.
    await pool.query(`CREATE FUNCTION fail_grant_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.target_user_id = 'rollback' THEN RAISE EXCEPTION 'audit unavailable'; END IF; RETURN NEW; END; $$;
      CREATE TRIGGER fail_audit BEFORE INSERT ON lkt_editorial_access_events FOR EACH ROW EXECUTE FUNCTION fail_grant_audit()`);
    await assert.rejects(changeEditorialAccess({ source: "panel", userId: "operator" }, {
      role: "editor", action: "grant", targetUserId: "rollback", displayName: "Rollback", reason: "Atomic check",
    }), (error: unknown) => error instanceof Error && error.cause instanceof Error && /audit unavailable/.test(error.cause.message));
    assert.equal((await db.select().from(lktEditors).where(eq(lktEditors.userId, "rollback"))).length, 0);
    await changeEditorialAccess({ source: "cli", operatorName: "Infrastructure human" }, {
      role: "operator", action: "revoke", targetUserId: "operator", displayName: "", reason: "Operator rotated",
    });
    assert.equal((await call("/editorial-access", "operator", grant)).status, 403);
    await assert.rejects(changeEditorialAccess({ source: "panel", userId: "operator" }, {
      role: "editor", action: "grant", targetUserId: "target", displayName: "Target", reason: "Stale session",
    }), /operator/);
    assert.equal((await db.select().from(lktEditorialAccessEvents)).length, 4);
  } finally {
    lookup.mock.restore();
    await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
    await pool.query(`DROP SCHEMA "${schema}" CASCADE`);
    pool.off("connect", setSchema);
    await pool.end();
  }
});
