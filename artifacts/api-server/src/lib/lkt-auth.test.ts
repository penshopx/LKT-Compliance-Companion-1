import { strict as assert } from "node:assert";
import { test } from "node:test";
import { randomUUID, createHmac } from "node:crypto";
import express from "express";
import { clerkClient } from "@clerk/express";
import { and, eq, inArray } from "drizzle-orm";
import {
  db, pool, lktOrganizations, lktMemberships, lktWorkspaces, lktMessages, lktActivities, lktAiUsage, lktAiLeases, lktAccessAudit,
} from "@workspace/db";
import lktRouter from "../routes/lkt";
import { LktAccessError, reserveConsultation, releaseConsultation } from "./lkt-ai-limits";
import { defaultProfile } from "./lkt-workspace";
import { CreateLktOrganizationResponse, GetCompanyResponse, GetMessagesResponse, GetLktAccountResponse, GetLktAccessAuditResponse } from "@workspace/api-zod";
import { purgeExpiredAccessAudit, recordAccessAudit } from "./lkt-access-audit";

// Test-only identity injection, never mounted in the real application.
// Real Clerk signature/session verification is checked separately in the browser.
test("company boundaries, legacy claims, deletion and durable quotas", async t => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const auth = Object.assign(
      () => ({ userId: req.get("test-user") ?? null, tokenType: "session_token" }),
      { [Symbol.for("@clerk/express.auth")]: true },
    );
    Object.assign(req, { auth });
    next();
  });
  app.use("/api", lktRouter);
  app.use(((err, _req, res, _next) => {
    res.status(err instanceof LktAccessError ? err.status : 500).json({ error: err.message });
  }) as express.ErrorRequestHandler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.on("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/api/lkt`;
  const a = `user_test${randomUUID().replaceAll("-", "")}`;
  const b = `user_test${randomUUID().replaceAll("-", "")}`;
  const ids: string[] = [];
  const legacyIds: string[] = [];
  const call = async (path: string, user: string | null, org?: string, method = "GET", body?: unknown, cookie?: string) => {
    const response = await fetch(base + path, {
      method, headers: {
        ...(user ? { "test-user": user } : {}),
        ...(org ? { "X-LKT-Organization": org } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      }, body: body ? JSON.stringify(body) : undefined,
    });
    const data = response.status === 204 ? null : await response.json();
    return { status: response.status, data, headers: response.headers };
  };
  const create = async (user: string, name = "Test company") => {
    const r = await call("/organizations", user, undefined, "POST", { name, importLegacy: false, confirmLegacyOwnership: false });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    const organization = CreateLktOrganizationResponse.parse(r.data);
    ids.push(organization.id);
    return organization.id;
  };
  const legacyCookie = (id: string) => {
    const signature = createHmac("sha256", process.env.SESSION_SECRET!).update(id).digest("base64").replace(/=+$/, "");
    return `lkt_workspace=${encodeURIComponent(`s:${id}.${signature}`)}`;
  };
  let orgA = "", orgB = "", workspaceA = "";
  try {
    await t.test("anonymous clients cannot reach private data or create browser workspaces", async () => {
      for (const path of ["/account", "/company", "/checklist", "/references", "/activity", "/messages", "/dashboard", "/access-audit"]) {
        assert.equal((await call(path, null, randomUUID())).status, 401);
      }
      assert.equal((await call("/organizations", null, undefined, "POST", { name: "No" })).status, 401);
    });
    orgA = await create(a, "Company A");
    orgB = await create(b, "Company B");
    const [workspace] = await db.select().from(lktWorkspaces).where(eq(lktWorkspaces.organizationId, orgA));
    workspaceA = workspace.id;
    await db.insert(lktMessages).values({ id: randomUUID(), workspaceId: workspaceA, role: "user", content: "Company A private consultation" });
    await db.insert(lktActivities).values({ id: randomUUID(), workspaceId: workspaceA, title: "Company A private activity" });
    await t.test("company ID is only a selector, not authority; all private routes reject outsiders", async () => {
      const paths = ["/company", "/checklist", "/references", "/activity", "/messages", "/dashboard", "/members", "/access-audit"];
      for (const path of paths) assert.equal((await call(path, b, orgA)).status, 403, path);
      for (const [path, method, body] of [
        ["/company", "PUT", { ...defaultProfile, name: "Stolen" }],
        ["/checklist/anything", "PATCH", { status: "selesai", notes: "stolen" }],
        ["/references/ciputra/bookmark", "PUT", { bookmarked: true }],
        ["/messages", "POST", { content: "Stolen" }],
        ["/messages", "DELETE", undefined],
        ["/members", "POST", { userId: b }],
        [`/members/${a}`, "DELETE", undefined],
        [`/organizations/${orgA}`, "DELETE", undefined],
      ] as const) assert.equal((await call(path, b, orgA, method, body)).status, 403, path);
      assert.equal((await call("/company", a)).status, 403);
      assert.equal(GetCompanyResponse.parse((await call("/company", a, orgA)).data).name, "Company A");
      assert.equal(GetMessagesResponse.parse((await call("/messages", a, orgA)).data).messages[0].content, "Company A private consultation");
      const listing = await call("/account", b);
      assert.equal(GetLktAccountResponse.parse(listing.data).organizations.some(o => o.id === orgA), false);
      const csrf = await fetch(base + "/company", { method: "PUT", headers: {
        "test-user": a, "X-LKT-Organization": orgA, Origin: "https://evil.example", "Content-Type": "application/json",
      }, body: JSON.stringify({ ...defaultProfile, name: "Cross site" }) });
      assert.equal(csrf.status, 403);
    });
    await t.test("access audit is atomic, owner-only, minimal and records only real changes", async () => {
      const users = clerkClient.users;
      const getUser = t.mock.method(users, "getUser", async () => ({
        emailAddresses: [{ verification: { status: "verified" } }],
      }));
      try {
        assert.equal((await call("/members", a, orgA, "POST", { userId: b, actorUserId: b, secret: "NEVER STORE" })).status, 201);
        assert.equal((await call("/members", a, orgA, "POST", { userId: b })).status, 201);
        assert.equal((await call("/access-audit", b, orgA)).status, 403, "even a current member cannot read audit");
        assert.equal((await call("/access-audit", a, orgB)).status, 403);
        const response = await call("/access-audit", a, orgA);
        assert.equal(response.status, 200);
        let audit = GetLktAccessAuditResponse.parse(response.data);
        assert.equal(audit.length, 1, "duplicate grants are not events");
        assert.equal(audit[0].actorUserId, a);
        assert.equal(audit[0].targetUserId, b);
        assert.equal(audit[0].action, "member_added");
        assert.ok(audit[0].createdAt.getTime());
        assert.ok(Math.abs(audit[0].expiresAt.getTime() - audit[0].createdAt.getTime() - 90 * 86400000) < 1000);
        assert.deepEqual(Object.keys(audit[0]).sort(), ["id", "actorUserId", "targetUserId", "action", "createdAt", "expiresAt"].sort());
        assert.equal(JSON.stringify(audit).includes("NEVER STORE"), false);
        assert.equal((await call(`/members/${a}`, a, orgA, "DELETE")).status, 204);
        assert.equal((await call(`/members/${b}`, a, orgA, "DELETE")).status, 204);
        assert.equal((await call(`/members/${b}`, a, orgA, "DELETE")).status, 204);
        audit = GetLktAccessAuditResponse.parse((await call("/access-audit", a, orgA)).data);
        assert.deepEqual(audit.map(e => e.action), ["member_removed", "member_added"]);
        await assert.rejects(db.transaction(async tx => {
          await tx.insert(lktMemberships).values({ organizationId: orgA, userId: b, role: "member" });
          await recordAccessAudit(tx, a, { action: "member_added", organizationId: orgA, targetUserId: b });
          throw new Error("rollback fixture");
        }));
        assert.equal(GetLktAccessAuditResponse.parse((await call("/access-audit", a, orgA)).data).length, 2);
        assert.equal((await call("/company", b, orgA)).status, 403);
        getUser.mock.mockImplementation(async () => { throw new Error("Clerk unavailable"); });
        assert.equal((await call("/members", a, orgA, "POST", { userId: b })).status, 400);
        assert.equal(GetLktAccessAuditResponse.parse((await call("/access-audit", a, orgA)).data).length, 2, "failed grant is not an event");
      } finally {
        getUser.mock.restore();
      }
    });
    await t.test("members can collaborate but cannot manage membership or delete company; revocation is immediate", async () => {
      await db.insert(lktMemberships).values({ organizationId: orgA, userId: b, role: "member" });
      assert.equal((await call("/company", b, orgA)).status, 200);
      assert.equal((await call("/company", b, orgA, "PUT", { ...defaultProfile, name: "Team update" })).status, 200);
      assert.equal((await call("/members", b, orgA, "POST", { userId: b })).status, 403);
      assert.equal((await call(`/organizations/${orgA}`, b, orgA, "DELETE")).status, 403);
      assert.equal((await call(`/members/${a}`, b, orgA, "DELETE")).status, 403);
      assert.equal((await call(`/members/${a}`, a, orgA, "DELETE")).status, 204);
      assert.equal((await call("/company", a, orgA)).status, 200, "owner is not removable");
      assert.equal((await call(`/members/${b}`, a, orgA, "DELETE")).status, 204);
      for (const path of ["/company", "/checklist", "/references", "/activity", "/messages", "/members"]) {
        assert.equal((await call(path, b, orgA)).status, 403);
      }
    });
    await t.test("legacy is quarantined; signed-cookie and explicit attestation claim it once, only into a NEW company", async () => {
      const id = randomUUID(); legacyIds.push(id);
      await db.insert(lktWorkspaces).values({
        id, profile: { ...defaultProfile, name: "Private legacy company" },
        tasks: { "2026:old": { status: "proses", notes: "Legacy private notes" } }, bookmarks: { ciputra: true },
      });
      await db.insert(lktMessages).values({ id: randomUUID(), workspaceId: id, role: "user", content: "Legacy private question" });
      const cookie = legacyCookie(id);
      assert.equal((await call("/company", a, undefined, "GET", undefined, cookie)).status, 403);
      assert.equal((await call("/company", null, id, "GET", undefined, cookie)).status, 401);
      const account = await call("/account", a, undefined, "GET", undefined, cookie);
      assert.equal(GetLktAccountResponse.parse(account.data).legacyAvailable, true);
      assert.equal(JSON.stringify(account.data).includes("Private legacy"), false);
      const body = { name: "New legacy company", importLegacy: true, confirmLegacyOwnership: false };
      assert.equal((await call("/organizations", a, undefined, "POST", body, cookie)).status, 400);
      body.confirmLegacyOwnership = true;
      assert.equal((await call("/organizations", a, undefined, "POST", body, `lkt_workspace=${id}`)).status, 400);
      const imported = await call("/organizations", a, orgB, "POST", body, cookie);
      assert.equal(imported.status, 201);
      const importedOrg = CreateLktOrganizationResponse.parse(imported.data);
      ids.push(importedOrg.id);
      assert.notEqual(importedOrg.id, orgB);
      assert.equal(GetCompanyResponse.parse((await call("/company", a, importedOrg.id)).data).name, "Private legacy company");
      assert.equal(GetMessagesResponse.parse((await call("/messages", a, importedOrg.id)).data).messages[0].content, "Legacy private question");
      assert.equal((await call("/company", b, importedOrg.id)).status, 403);
      assert.equal((await call("/organizations", b, undefined, "POST", body, cookie)).status, 409);
      await call("/legacy", b, undefined, "DELETE", undefined, cookie);
      assert.equal((await call("/company", a, importedOrg.id)).status, 200, "stale cookie cannot delete claimed company");
      const discarded = randomUUID(); legacyIds.push(discarded);
      await db.insert(lktWorkspaces).values({ id: discarded, profile: defaultProfile });
      await db.insert(lktMessages).values({ id: randomUUID(), workspaceId: discarded, role: "user", content: "Discard fixture" });
      assert.equal((await call("/legacy", a, undefined, "DELETE", undefined, legacyCookie(discarded))).status, 204);
      assert.equal((await db.select().from(lktWorkspaces).where(eq(lktWorkspaces.id, discarded))).length, 0);
      assert.equal((await db.select().from(lktMessages).where(eq(lktMessages.workspaceId, discarded))).length, 0);
    });
    await t.test("durable limits apply to account across companies; concurrent organization calls conflict", async () => {
      for (let i = 0; i < 12; i++) {
        const org = i % 2 ? await create(a) : orgA;
        const lease = await reserveConsultation(org, a);
        await releaseConsultation(org, lease);
      }
      await assert.rejects(reserveConsultation(orgA, a), (e: unknown) => e instanceof LktAccessError && e.status === 429);
      const [usage] = await db.select().from(lktAiUsage).where(eq(lktAiUsage.key, `account:${a}`));
      assert.equal(usage.count, 12);
      const concurrent = await Promise.allSettled([reserveConsultation(orgB, b), reserveConsultation(orgB, b)]);
      assert.equal(concurrent.filter(r => r.status === "fulfilled").length, 1);
      assert.equal(concurrent.filter(r => r.status === "rejected" && r.reason.status === 409).length, 1);
      assert.equal((await call(`/organizations/${orgB}`, b, undefined, "DELETE")).status, 409);
      await db.update(lktAiLeases).set({ expiresAt: new Date(0) }).where(eq(lktAiLeases.organizationId, orgB));
      await db.insert(lktAiUsage).values({
        key: `organization:${orgB}`, count: 36, resetAt: new Date(Date.now() + 3600000),
      }).onConflictDoUpdate({ target: lktAiUsage.key, set: { count: 36 } });
      await assert.rejects(reserveConsultation(orgB, b), (e: unknown) => e instanceof LktAccessError && e.status === 429);
      await db.update(lktAiUsage).set({ resetAt: new Date(0) }).where(inArray(lktAiUsage.key, [`organization:${orgB}`, `account:${b}`]));
      const recovered = await reserveConsultation(orgB, b);
      await releaseConsultation(orgB, recovered);
    });
    await t.test("owner deletion cascades private state and members, preserving only bounded anti-abuse account counter", async () => {
      assert.equal((await call(`/organizations/${orgA}`, a, undefined, "DELETE")).status, 204);
      assert.equal((await db.select().from(lktWorkspaces).where(eq(lktWorkspaces.id, workspaceA))).length, 0);
      assert.equal((await db.select().from(lktMessages).where(eq(lktMessages.workspaceId, workspaceA))).length, 0);
      assert.equal((await db.select().from(lktActivities).where(eq(lktActivities.workspaceId, workspaceA))).length, 0);
      assert.equal((await db.select().from(lktMemberships).where(eq(lktMemberships.organizationId, orgA))).length, 0);
      assert.equal((await call("/company", a, orgA)).status, 403);
      assert.equal((await call("/access-audit", a, orgA)).status, 403);
      assert.equal((await db.select().from(lktAccessAudit).where(eq(lktAccessAudit.organizationId, orgA))).length, 0);
      const account = GetLktAccountResponse.parse((await call("/account", a)).data);
      assert.equal(account.deletionReceipts.length, 1);
      assert.equal(account.deletionReceipts[0].actorUserId, a);
      assert.equal(account.deletionReceipts[0].action, "organization_deleted");
      assert.equal(account.deletionReceipts[0].targetUserId, null);
      assert.equal(JSON.stringify(account.deletionReceipts).includes(orgA), false);
      assert.equal(GetLktAccountResponse.parse((await call("/account", b)).data).deletionReceipts.length, 0);
      const [stored] = await db.select().from(lktAccessAudit).where(eq(lktAccessAudit.id, account.deletionReceipts[0].id));
      assert.equal(stored.organizationId, null);
      assert.equal((await db.select().from(lktAiUsage).where(eq(lktAiUsage.key, `organization:${orgA}`))).length, 0);
    });
    await t.test("expired audit and receipts are hidden immediately and physically removed", async () => {
      const expiredIds = [randomUUID(), randomUUID()];
      await db.insert(lktAccessAudit).values([
        { id: expiredIds[0], actorUserId: b, action: "member_added", organizationId: orgB, targetUserId: a, expiresAt: new Date(0) },
        { id: expiredIds[1], actorUserId: a, action: "organization_deleted", expiresAt: new Date(0) },
      ]);
      assert.equal(GetLktAccessAuditResponse.parse((await call("/access-audit", b, orgB)).data).length, 0);
      assert.equal(GetLktAccountResponse.parse((await call("/account", a)).data).deletionReceipts.length, 1);
      await purgeExpiredAccessAudit();
      assert.equal((await db.select().from(lktAccessAudit).where(inArray(lktAccessAudit.id, expiredIds))).length, 0);
      assert.equal(GetLktAccountResponse.parse((await call("/account", a)).data).deletionReceipts.length, 1, "live receipt survives");
    });
  } finally {
    if (ids.length) await db.delete(lktOrganizations).where(inArray(lktOrganizations.id, ids));
    if (legacyIds.length) await db.delete(lktWorkspaces).where(and(inArray(lktWorkspaces.id, legacyIds)));
    await db.delete(lktAiUsage).where(inArray(lktAiUsage.key, [`account:${a}`, `account:${b}`, ...ids.map(id => `organization:${id}`)]));
    await db.delete(lktAccessAudit).where(inArray(lktAccessAudit.actorUserId, [a, b]));
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await pool.end();
  }
});
