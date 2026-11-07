import { strict as assert } from "node:assert";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import express from "express";
import { eq } from "drizzle-orm";
import { db, pool, lktEditors, lktEditorialEvents, lktOrganizations, lktMemberships, lktWorkspaces } from "@workspace/db";
import { AppendEditorialEventResponse, CreateEditorialDraftResponse, GetEditorialWorkspaceResponse, GetReferencesResponse, type EditorialEventInput } from "@workspace/api-zod";
import lktRouter from "../routes/lkt";
import { LktAccessError } from "./lkt-ai-limits";
import { references } from "./lkt-content";
import { editorialDay } from "./lkt-reference-review";
import { getEditorialReferences, validCalendarDay } from "./lkt-editorial";
import { createReferenceSnapshot } from "./lkt-consultation-snapshot";
import { defaultProfile } from "./lkt-workspace";

test("calendar validation rejects impossible days without timezone coercion", () => {
  for (const day of ["2028-02-29", "2026-12-31"]) assert.equal(validCalendarDay(day), true);
  for (const day of ["2026-02-29", "2026-04-31", "2026-00-01", "2026-13-01", "2026-11-06T00:00:00Z"]) assert.equal(validCalendarDay(day), false);
});

test("editorial permissions, immutable snapshots, conflicts, read projection and revocation", async t => {
  // Dedicated schema: tests never append fixtures to the real shared library.
  const schema = `editorial_test_${randomUUID().replaceAll("-", "")}`;
  const connection = await pool.connect();
  await connection.query(`CREATE SCHEMA "${schema}"`);
  await connection.query(`SET search_path TO "${schema}"`);
  pool.on("connect", client => { void client.query(`SET search_path TO "${schema}"`); });
  await connection.query(await readFile(new URL("../../../../lib/db/migrations/lkt-editorial.sql", import.meta.url), "utf8"));
  await connection.query(await readFile(new URL("../../../../lib/db/migrations/lkt-editorial-drafts.sql", import.meta.url), "utf8"));
  await connection.query(await readFile(new URL("../../../../lib/db/migrations/lkt-evidence-archives.sql", import.meta.url), "utf8"));
  await connection.query(`
    CREATE TABLE lkt_organizations (id text PRIMARY KEY, name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE lkt_memberships (organization_id text NOT NULL, user_id text NOT NULL, role text NOT NULL, PRIMARY KEY(organization_id, user_id));
    CREATE TABLE lkt_workspaces (id text PRIMARY KEY, organization_id text UNIQUE, profile jsonb NOT NULL,
      tasks jsonb NOT NULL DEFAULT '{}', bookmarks jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE lkt_activities (id text PRIMARY KEY, workspace_id text NOT NULL, title text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
  `);
  connection.release();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    Object.assign(req, { auth: Object.assign(
      () => ({ userId: req.get("test-user") ?? null, tokenType: "session_token" }),
      { [Symbol.for("@clerk/express.auth")]: true },
    ) });
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
  const editor = "fixture_editor", assignee = "fixture_assignee", owner = "fixture_owner", member = "fixture_member";
  const ref = references.find(item => item.id === "iai-ep")!;
  const original = structuredClone(ref);
  const call = async (path: string, user?: string, method = "GET", body?: unknown, extra: Record<string, string> = {}) => {
    const response = await fetch(base + path, { method, headers: {
      ...(user ? { "test-user": user } : {}), ...(body ? { "Content-Type": "application/json" } : {}), ...extra,
    }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, data: response.status === 204 ? null : await response.json() };
  };
  const input: EditorialEventInput = {
    kind: "schedule", expectedRevision: ref.reviewHistory.length, assigneeUserId: assignee,
    nextReviewAt: "2099-12-31", changeSummary: "Fixture reschedule; no verification performed",
  };
  const post = (body: unknown, user = editor) => call(`/editorial/references/${ref.id}/events`, user, "POST", body);
  const save = (body: unknown, user = editor) => call(`/editorial/references/${ref.id}/drafts`, user, "POST", body);
  try {
    await db.insert(lktEditors).values([{ userId: editor, displayName: "Editor Fixture" }, { userId: assignee, displayName: "Human Fixture" }]);
    await db.insert(lktOrganizations).values({ id: "fixture_org", name: "Fixture" });
    await db.insert(lktMemberships).values([{ organizationId: "fixture_org", userId: owner, role: "owner" }, { organizationId: "fixture_org", userId: member, role: "member" }]);
    await db.insert(lktWorkspaces).values({ id: "fixture_workspace", organizationId: "fixture_org", profile: defaultProfile });
    await t.test("anonymous denied; company owners and members cannot edit or see roster", async () => {
      assert.equal((await call("/editorial")).status, 401);
      assert.equal((await call(`/editorial/references/${ref.id}/events`, undefined, "POST", input)).status, 401);
      for (const user of [owner, member]) {
        assert.equal((await post(input, user)).status, 403);
        const workspace = await call("/editorial", user);
        assert.deepEqual(workspace.data, { canEdit: false, currentUserId: user, drafts: [], members: [], references: [] });
        assert.equal((await save(input, user)).status, 403);
      }
      assert.equal(GetEditorialWorkspaceResponse.parse((await call("/editorial", editor)).data).canEdit, true); // no company header
      assert.equal((await post({ ...input, assigneeUserId: owner })).status, 400);
      assert.equal((await post({ ...input, nextReviewAt: "2026-02-30" })).status, 400);
      assert.equal((await post({ ...input, nextReviewAt: "2000-01-01" })).status, 400);
      assert.equal((await post({ ...input, changeSummary: "  " })).status, 400);
      assert.equal((await post({ ...input, actorUserId: owner })).status, 400);
      assert.equal((await call(`/editorial/references/${ref.id}/events`, editor, "POST", input, { origin: "https://evil.example" })).status, 403);
    });
    let scheduled = original;
    await t.test("schedule appends full snapshot without upgrading or re-dating findings", async () => {
      const response = await post(input);
      assert.equal(response.status, 201, JSON.stringify(response.data));
      scheduled = AppendEditorialEventResponse.parse(response.data);
      assert.equal(scheduled.reviewHistory.length, original.reviewHistory.length + 1);
      assert.deepEqual(scheduled.reviewHistory.slice(0, -1), original.reviewHistory);
      assert.equal(scheduled.reviewedAt, original.reviewedAt);
      assert.equal(scheduled.verificationStatus, original.verificationStatus);
      assert.deepEqual(scheduled.primarySources, original.primarySources);
      assert.equal(scheduled.editorialOwner, "Human Fixture");
      assert.equal(scheduled.assigneeUserId, assignee);
      assert.equal(scheduled.nextReviewAt, "2099-12-31");
      assert.equal(scheduled.reviewHistory.at(-1)!.actorUserId, editor);
      assert.equal(scheduled.reviewHistory.at(-1)!.recordedAt, editorialDay());
      assert.equal(createReferenceSnapshot([scheduled]).knowledgeVersion, createReferenceSnapshot([original]).knowledgeVersion);
      assert.equal((await post(input)).status, 409);
      const shared = await call("/references", owner, "GET", undefined, { "X-LKT-Organization": "fixture_org" });
      assert.equal(shared.status, 200);
      assert.equal(GetReferencesResponse.parse(shared.data).find(item => item.id === ref.id)!.nextReviewAt, input.nextReviewAt);
    });
    const findings: EditorialEventInput = {
      ...input, kind: "findings", expectedRevision: scheduled.reviewHistory.length,
      findings: {
        verificationStatus: "needs_review", verificationNotes: "Fixture: bounded finding, not a compliance opinion",
        applicability: "Fixture scope only", effectivePeriod: "Fixture period only",
        standards: [], primarySources: [{ title: "Fixture evidence", url: "https://example.com/source", locator: "Article 1", finding: "Fixture finding" }],
      },
    };
    await t.test("complete findings required; unsafe evidence and false primary upgrades rejected", async () => {
      assert.equal((await post(findings)).status, 400); // old publication path cannot bypass approval
      assert.equal((await save({ ...findings, findings: undefined })).status, 400);
      assert.equal((await save({ ...findings, findings: { ...findings.findings, verificationNotes: " " } })).status, 400);
      assert.equal((await post({ ...findings, kind: "schedule" })).status, 400);
      assert.equal((await save({ ...findings, findings: { ...findings.findings, verificationStatus: "verified_primary", primarySources: [] } })).status, 400);
      assert.equal((await save({ ...findings, findings: { ...findings.findings, primarySources: [{ title: "Bad", url: "javascript:alert(1)", locator: "1", finding: "No" }] } })).status, 400);
      const secondary = references.find(item => item.sourceType === "secondary")!;
      assert.equal((await call(`/editorial/references/${secondary.id}/drafts`, editor, "POST", {
        ...findings, expectedRevision: secondary.reviewHistory.length,
        findings: { ...findings.findings, verificationStatus: "verified_primary" },
      })).status, 400);
    });
    await t.test("drafts remain private; authors cannot approve; revisions and publication are atomic", async () => {
      const created = await save(findings);
      assert.equal(created.status, 201, JSON.stringify(created.data));
      let draft = CreateEditorialDraftResponse.parse(created.data);
      const approve = (user = assignee, version = draft.version, revision = draft.baseRevision) => call(`/editorial/drafts/${draft.id}/approve`, user, "POST", { expectedVersion: version, expectedRevision: revision });
      const update = (user = editor, version = draft.version, data = findings) => call(`/editorial/drafts/${draft.id}`, user, "PUT", { expectedVersion: version, input: data });
      assert.deepEqual((await getEditorialReferences()).find(item => item.id === ref.id), scheduled);
      assert.equal((await approve(editor)).status, 403);
      assert.equal((await approve(owner)).status, 403);
      assert.equal((await update(assignee)).status, 403);
      const edits = await Promise.all([update(), update()]);
      assert.deepEqual(edits.map(r => r.status).sort(), [200, 409]);
      draft = CreateEditorialDraftResponse.parse(edits.find(r => r.status === 200)!.data);
      assert.equal((await approve(assignee, 1)).status, 409);
      // Schedule-only changes also invalidate the draft's base revision.
      assert.equal((await post({ ...input, expectedRevision: scheduled.reviewHistory.length })).status, 201);
      assert.equal((await approve()).status, 409);
      const rebased = { ...findings, expectedRevision: scheduled.reviewHistory.length + 1 };
      const revised = await update(editor, draft.version, rebased);
      assert.equal(revised.status, 200, JSON.stringify(revised.data));
      draft = CreateEditorialDraftResponse.parse(revised.data);
      const responses = await Promise.all([approve(), approve()]);
      assert.deepEqual(responses.map(response => response.status).sort(), [201, 409]);
      const latest = (await getEditorialReferences()).find(item => item.id === ref.id)!;
      assert.equal(latest.reviewHistory.length, original.reviewHistory.length + 3);
      assert.deepEqual(latest.reviewHistory.slice(0, scheduled.reviewHistory.length), scheduled.reviewHistory);
      assert.equal(latest.verificationNotes, findings.findings!.verificationNotes);
      assert.deepEqual(latest.primarySources, findings.findings!.primarySources);
      assert.equal(latest.reviewedAt, editorialDay());
      assert.equal(latest.verified, false);
      assert.equal(latest.reviewHistory.at(-1)!.approvedByUserId, assignee);
      assert.equal(latest.reviewHistory.at(-1)!.actorUserId, editor);
      assert.equal(latest.reviewHistory.at(-1)!.draftVersion, draft.version);
      assert.equal(latest.reviewHistory.at(-1)!.recordedAt, draft.snapshot.recordedAt);
      assert.equal((await update(editor, draft.version, { ...rebased, expectedRevision: latest.reviewHistory.length })).status, 409);
      assert.notEqual(createReferenceSnapshot([latest]).knowledgeVersion, createReferenceSnapshot([original]).knowledgeVersion);
      assert.deepEqual(AppendEditorialEventResponse.parse(latest), latest);
      assert.deepEqual(ref, original);
    });
    await t.test("database disallows updates/deletes/truncation, including after revocation", async () => {
      const created = await save({ ...findings, expectedRevision: original.reviewHistory.length + 3 });
      assert.equal(created.status, 201);
      const draft = CreateEditorialDraftResponse.parse(created.data);
      await assert.rejects(pool.query("UPDATE lkt_editorial_events SET reference_id = 'rewritten'"), /append-only/);
      await assert.rejects(pool.query("DELETE FROM lkt_editorial_events"), /append-only/);
      await assert.rejects(pool.query("TRUNCATE lkt_editorial_events"), /append-only/);
      await db.delete(lktEditors).where(eq(lktEditors.userId, editor));
      assert.equal((await post({ ...findings, expectedRevision: scheduled.reviewHistory.length + 1 })).status, 403);
      assert.equal((await call(`/editorial/drafts/${draft.id}/approve`, assignee, "POST", { expectedVersion: draft.version, expectedRevision: draft.baseRevision })).status, 403);
      assert.equal((await getEditorialReferences()).find(item => item.id === ref.id)!.reviewHistory.length, original.reviewHistory.length + 3);
    });
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await pool.query(`DROP SCHEMA "${schema}" CASCADE`);
    await pool.end();
  }
});
