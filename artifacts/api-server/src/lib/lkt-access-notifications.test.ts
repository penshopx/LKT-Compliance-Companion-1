import { strict as assert } from "node:assert";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import express from "express";
import { clerkClient } from "@clerk/express";
import { and, eq, sql } from "drizzle-orm";
import { db, pool, lktOrganizations, lktMemberships, lktWorkspaces, lktAccessDeliveries, lktAccessNotifications, lktAccessAudit } from "@workspace/db";
import { GetAccessNotificationsResponse, SaveAccessNotificationsBody } from "@workspace/api-zod";
import lktRouter from "../routes/lkt";
import { LktAccessError } from "./lkt-ai-limits";
import { recordAccessAudit } from "./lkt-access-audit";
import {
  accessNotificationText, configureAccessNotifications, readAccessNotifications,
  processAccessNotifications, stopAccessNotifications, withAccessNotificationLock,
} from "./lkt-access-notifications";

const destination = {
  recipientLabel: "Fixture DM", slackChannelId: "D123456789", slackTeamId: "T123456789", connectionId: "fixture",
};
const input = { recipient: "U123456789", consent: true as const, expectedRevision: 0 };

test("explicit consent and minimal safe message", () => {
  for (const change of [{ consent: false }, { recipient: "D123456789" }, { recipient: "https://evil.example" }, { expectedRevision: -1 }, { extra: "secret" }]) {
    assert.equal(SaveAccessNotificationsBody.strict().safeParse({ ...input, ...change }).success, false);
  }
  assert.equal(SaveAccessNotificationsBody.strict().safeParse(input).success, true);
  const message = accessNotificationText("A\n<@everyone>", "member_removed", new Date("2026-11-07T01:00:00Z"));
  assert.match(message, /Akses anggota dicabut/);
  assert.match(message, /2026-11-07T01:00:00.000Z/);
  assert.ok(!message.includes("<") && !message.includes("user_"));
});

test("transactional outbox, owner authorization, deduplication, restart and company deletion", async t => {
  pool.options.connectionTimeoutMillis = 2000;
  const schema = `access_notify_${randomUUID().replaceAll("-", "")}`;
  const connection = await pool.connect();
  await connection.query(`CREATE SCHEMA "${schema}"; SET search_path TO "${schema}"`);
  pool.on("connect", client => { void client.query(`SET search_path TO "${schema}"`); });
  await connection.query(`
    CREATE TABLE lkt_organizations (id text PRIMARY KEY, name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE lkt_memberships (organization_id text NOT NULL REFERENCES lkt_organizations(id) ON DELETE CASCADE,
      user_id text NOT NULL, role text NOT NULL, PRIMARY KEY(organization_id,user_id));
    CREATE TABLE lkt_workspaces (id text PRIMARY KEY, organization_id text UNIQUE REFERENCES lkt_organizations(id) ON DELETE CASCADE,
      profile jsonb NOT NULL, tasks jsonb NOT NULL DEFAULT '{}', bookmarks jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE lkt_ai_usage (key text PRIMARY KEY, reset_at timestamptz NOT NULL, count integer NOT NULL DEFAULT 0);
    CREATE TABLE lkt_ai_leases (organization_id text PRIMARY KEY, request_id text NOT NULL, expires_at timestamptz NOT NULL);
    CREATE TABLE lkt_access_audit (id text PRIMARY KEY, organization_id text REFERENCES lkt_organizations(id) ON DELETE CASCADE,
      actor_user_id text NOT NULL, action text NOT NULL, target_user_id text, created_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL DEFAULT now() + interval '90 days');
  `);
  await connection.query(await readFile(new URL("../../../../lib/db/migrations/lkt-access-notifications.sql", import.meta.url), "utf8"));
  connection.release();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    Object.assign(req, { auth: Object.assign(() => ({ userId: req.get("test-user") ?? null, tokenType: "session_token" }),
      { [Symbol.for("@clerk/express.auth")]: true }) });
    next();
  });
  app.use("/api", lktRouter);
  app.use(((err, _req, res, _next) => {
    res.status(err instanceof LktAccessError ? err.status : 500).json({ error: err.message });
  }) as express.ErrorRequestHandler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(r => server.on("listening", r));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const org = randomUUID(), other = randomUUID();
  const owner = "user_owner", member = "user_member", outsider = "user_outsider";
  const call = async (path: string, user = owner, method = "GET", body?: unknown, company = org) => {
    const res = await fetch(`http://127.0.0.1:${address.port}/api/lkt${path}`, {
      method, headers: { "test-user": user, "X-LKT-Organization": company, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, data: res.status === 204 ? null : await res.json() };
  };
  const users = t.mock.method(clerkClient.users, "getUser", async () => ({ emailAddresses: [{ verification: { status: "verified" } }] }));
  const resolve = async () => destination;
  const queue = async (company = org) => (await db.select().from(lktAccessDeliveries).where(eq(lktAccessDeliveries.organizationId, company)));
  let sent = 0;
  const send = async (_destination: unknown, text: string) => {
    assert.ok(!text.includes(member) && !text.includes(owner));
    assert.ok(!text.includes("consultation"));
    sent++;
    return { status: "delivered" as const, detail: null };
  };
  try {
    await db.insert(lktOrganizations).values([{ id: org, name: "Fixture company" }, { id: other, name: "Other" }]);
    await db.insert(lktMemberships).values([
      { organizationId: org, userId: owner, role: "owner" },
      { organizationId: other, userId: outsider, role: "owner" },
    ]);
    await db.insert(lktWorkspaces).values([
      { id: randomUUID(), organizationId: org, profile: { name: "Fixture", kind: "umkm", year: 2026, standard: "SAK EMKM" } },
      { id: randomUUID(), organizationId: other, profile: { name: "Other", kind: "umkm", year: 2026, standard: "SAK EMKM" } },
    ]);
    await t.test("defaults are off, API validates consent and denies anonymous/other owners", async () => {
      assert.equal(GetAccessNotificationsResponse.parse((await call("/access-notifications")).data).enabled, false);
      assert.equal((await call("/access-notifications", "", "GET")).status, 401);
      assert.equal((await call("/access-notifications", outsider)).status, 403);
      assert.equal((await call("/access-notifications", owner, "PUT", { ...input, consent: false })).status, 400);
      assert.equal((await call("/members", owner, "POST", { userId: member })).status, 201);
      assert.equal((await queue()).length, 0);
      assert.equal((await call("/access-notifications", member)).status, 403);
      assert.equal((await call("/access-notifications", member, "DELETE")).status, 403);
      await configureAccessNotifications(org, owner, input, resolve);
      assert.equal((await queue()).length, 0, "no historic or test messages");
      await assert.rejects(configureAccessNotifications(other, owner, input, resolve), /Akses|pemilik|perusahaan/i);
      await assert.rejects(configureAccessNotifications(org, owner, input, resolve), /berubah/);
      assert.equal(GetAccessNotificationsResponse.parse((await call("/access-notifications")).data).enabled, true);
      await assert.rejects(configureAccessNotifications(org, owner, { ...input, expectedRevision: 1 },
        async () => { throw new Error("fixture disconnected"); }), /disconnected/);
      assert.equal((await readAccessNotifications(org, owner)).revision, 1);
    });
    await t.test("only real changes commit once; rollback and request retries produce no extra deliveries", async () => {
      await assert.rejects(db.transaction(async tx => {
        await recordAccessAudit(tx, owner, { action: "member_added", organizationId: org, targetUserId: "user_rollback" });
        throw new Error("rollback");
      }), /rollback/);
      assert.equal((await queue()).length, 0);
      assert.equal((await call("/members", owner, "POST", { userId: member })).status, 201);
      assert.equal((await queue()).length, 0, "already a member");
      assert.equal((await call(`/members/${member}`, owner, "DELETE")).status, 204);
      assert.equal((await call(`/members/${member}`, owner, "DELETE")).status, 204);
      assert.equal((await queue()).length, 1);
      assert.equal((await call("/members", owner, "POST", { userId: member })).status, 201);
      assert.equal((await call("/members", owner, "POST", { userId: member })).status, 201);
      assert.equal((await queue()).length, 2);
      await processAccessNotifications(org, send);
      await processAccessNotifications(org, send);
      await processAccessNotifications(org, send);
      assert.equal(sent, 2);
      assert.ok((await queue()).every(row => row.status === "delivered"));
      assert.equal((await queue(other)).length, 0);
    });
    await t.test("durable claim blocks concurrency and deletion, ambiguous and interrupted sends never replay", async () => {
      await call(`/members/${member}`, owner, "DELETE");
      let release!: () => void, entered!: () => void;
      const gate = new Promise<void>(r => { release = r; });
      const started = new Promise<void>(r => { entered = r; });
      const work = processAccessNotifications(org, async () => {
        const rows = await queue();
        assert.ok(rows.some(row => row.status === "sending"), "claim committed before send");
        entered(); await gate;
        return { status: "uncertain", detail: "fixture timeout" };
      });
      await started;
      try {
        await assert.rejects(processAccessNotifications(org, send), /sedang berjalan/);
        assert.equal((await call(`/organizations/${org}`, owner, "DELETE")).status, 409);
        await assert.rejects(stopAccessNotifications(org, owner), /sedang berjalan/);
      } finally { release(); }
      await work;
      await processAccessNotifications(org, send);
      assert.equal(sent, 2);
      await call("/members", owner, "POST", { userId: member });
      await db.update(lktAccessDeliveries).set({ status: "sending" }).where(and(eq(lktAccessDeliveries.organizationId, org), eq(lktAccessDeliveries.status, "pending")));
      await processAccessNotifications(org, send);
      assert.equal(sent, 2, "restart cannot replay sending claim");
      assert.equal((await queue()).filter(row => row.status === "uncertain").length, 2);
    });
    await t.test("reconfiguration and stop cancel pending; no other company affected", async () => {
      await call(`/members/${member}`, owner, "DELETE");
      await configureAccessNotifications(org, owner, { ...input, recipient: "C123456789", expectedRevision: 1 }, resolve);
      assert.equal((await queue()).filter(row => row.status === "pending").length, 0);
      await call("/members", owner, "POST", { userId: member });
      assert.ok((await queue()).some(row => row.status === "pending"));
      assert.equal((await call("/access-notifications", owner, "DELETE")).status, 200);
      assert.equal((await readAccessNotifications(org, owner)).enabled, false);
      await processAccessNotifications(org, send);
      assert.equal(sent, 2);
      await configureAccessNotifications(other, outsider, input, resolve);
      assert.equal((await readAccessNotifications(other, outsider)).enabled, true);
    });
    await t.test("provider rejection is visible and terminal, audit retention cascades outbox", async () => {
      await configureAccessNotifications(org, owner, { ...input, expectedRevision: 3 }, resolve);
      await call(`/members/${member}`, owner, "DELETE");
      let attempts = 0;
      await processAccessNotifications(org, async () => { attempts++; return { status: "retry", detail: "rate limited" }; });
      await processAccessNotifications(org, async () => { attempts++; return { status: "delivered", detail: null }; });
      assert.equal(attempts, 1);
      const [failed] = (await queue()).filter(row => row.status === "failed");
      assert.ok(failed);
      await db.delete(lktAccessAudit).where(eq(lktAccessAudit.id, failed.id));
      assert.equal((await queue()).some(row => row.id === failed.id), false);
    });
    await t.test("company deletion purges config, queued identifiers and delivery history atomically", async () => {
      await call("/members", owner, "POST", { userId: member });
      assert.ok((await queue()).some(row => row.status === "pending"));
      assert.equal((await call(`/organizations/${org}`, owner, "DELETE")).status, 204);
      assert.equal((await queue()).length, 0);
      assert.equal((await db.select().from(lktAccessNotifications).where(eq(lktAccessNotifications.organizationId, org))).length, 0);
      await processAccessNotifications(org, send);
      assert.equal(sent, 2);
      assert.equal((await readAccessNotifications(other, outsider)).enabled, true);
    });
    await t.test("session locks reuse one pool slot even for concurrent companies", async () => {
      const count = pool.options.max ?? 10;
      await Promise.all(Array.from({ length: count }, (_, i) => withAccessNotificationLock(`fixture-${i}`, async database => {
        await database.execute(sql`SELECT pg_sleep(0.02)`);
      })));
    });
  } finally {
    users.mock.restore();
    await new Promise<void>((r, reject) => server.close(err => err ? reject(err) : r()));
    await db.execute(sql.raw(`DROP SCHEMA "${schema}" CASCADE`));
    await pool.end();
  }
});
