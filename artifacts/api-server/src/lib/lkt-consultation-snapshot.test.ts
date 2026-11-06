import { strict as assert } from "node:assert";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import express from "express";
import { eq, inArray } from "drizzle-orm";
import { db, pool, lktOrganizations, lktMemberships, lktWorkspaces, lktMessages, lktAiUsage } from "@workspace/db";
import { AskConsultantResponse, GetMessagesResponse } from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import consultationRouter from "../routes/lkt-consultation";
import { references } from "./lkt-content";
import { consultationReferenceContext, createReferenceSnapshot, referenceFreshness } from "./lkt-consultation-snapshot";
import { defaultProfile, recentMessages } from "./lkt-workspace";

test("versions cover AI evidence, not clocks, ordering or bookmarks", () => {
  const original = createReferenceSnapshot(references);
  const later = createReferenceSnapshot([...references].reverse().map(r => ({ ...r, bookmarked: !r.bookmarked })), new Date("2030-01-01"));
  assert.equal(original.knowledgeVersion, later.knowledgeVersion);
  assert.notEqual(original.capturedAt, later.capturedAt);
  for (const field of ["reviewedAt", "verificationStatus", "verificationNotes", "effectivePeriod", "applicability", "primarySources"] as const) {
    const changed = structuredClone(references);
    if (field === "primarySources") changed[0].primarySources.push({ title: "New evidence", url: "https://example.com", locator: "Article 1", finding: "Changed finding" });
    else if (field === "verificationStatus") changed[0][field] = changed[0][field] === "outdated" ? "needs_review" : "outdated";
    else changed[0][field] = field === "reviewedAt" ? "2026-11-07" : "Changed";
    assert.notEqual(createReferenceSnapshot(changed).knowledgeVersion, original.knowledgeVersion, field);
  }
  assert.notEqual(createReferenceSnapshot(references.slice(1)).knowledgeVersion, original.knowledgeVersion);
  assert.equal(referenceFreshness("assistant", null, original.knowledgeVersion), "missing");
  assert.equal(referenceFreshness("user", null, original.knowledgeVersion), "not_applicable");
});

test("new answer persists snapshot; reloaded legacy and changed answers warn without rewriting history", async t => {
  const orgId = `snapshot-test-${randomUUID()}`;
  const userId = `snapshot-test-${randomUUID()}`;
  const workspaceId = randomUUID();
  const legacyId = randomUUID();
  const legacyTime = new Date("2026-01-01T10:00:00Z");
  const sourceBefore = references[0];
  const app = express();
  app.use(express.json());
  app.use((_req, res, next) => {
    res.locals.workspace = { id: workspaceId, profile: defaultProfile };
    res.locals.organizationId = orgId;
    res.locals.userId = userId;
    next();
  });
  app.get("/lkt/messages", async (_req, res) => {
    res.json(GetMessagesResponse.parse(await recentMessages(workspaceId)));
  });
  app.use(consultationRouter);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.on("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/lkt/messages`;
  // Stub only the external provider; run the actual POST, authorization, storage,
  // and fresh GET paths. No model credits or user data are used by this test.
  const provider = t.mock.method(openai.chat.completions, "create", async (input: { messages: { role: string; content: string }[] }) => {
    assert.ok(input.messages[0].content.includes(JSON.stringify(consultationReferenceContext(references))));
    assert.ok(input.messages.some(m => m.role === "assistant" && m.content.includes("[Jawaban historis:")));
    return { choices: [{ message: { content: "Jawaban baru untuk pengujian snapshot." } }] };
  });
  try {
    await db.insert(lktOrganizations).values({ id: orgId, name: "Snapshot isolated fixture" });
    await db.insert(lktMemberships).values({ organizationId: orgId, userId, role: "owner" });
    await db.insert(lktWorkspaces).values({ id: workspaceId, organizationId: orgId, profile: defaultProfile });
    await db.insert(lktMessages).values({ id: legacyId, workspaceId, role: "assistant", content: "Jawaban lama tetap utuh.", createdAt: legacyTime });
    const response = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: "Pertanyaan snapshot?" }) });
    assert.equal(response.status, 200, await response.clone().text());
    const created = AskConsultantResponse.parse(await response.json());
    assert.equal(created.referenceFreshness, "current");
    assert.ok(created.referenceSnapshot);
    assert.equal(created.referenceSnapshot.references.length, references.length);
    assert.equal(provider.mock.callCount(), 1);
    const reload = async () => GetMessagesResponse.parse(await (await fetch(base)).json());
    const loaded = await reload();
    assert.equal(loaded.find(m => m.id === legacyId)?.referenceFreshness, "missing");
    assert.equal(loaded.find(m => m.role === "user")?.referenceFreshness, "not_applicable");
    assert.deepEqual(loaded.find(m => m.id === created.id), created);
    const before = await db.select().from(lktMessages).where(eq(lktMessages.workspaceId, workspaceId));
    references[0] = { ...references[0], verificationNotes: "Updated editorial evidence for isolated test." };
    const changed = await reload();
    assert.equal(changed.find(m => m.id === created.id)?.referenceFreshness, "changed");
    assert.equal(changed.find(m => m.id === legacyId)?.referenceFreshness, "missing");
    assert.deepEqual(changed.find(m => m.id === created.id)?.referenceSnapshot, created.referenceSnapshot);
    const after = await db.select().from(lktMessages).where(eq(lktMessages.workspaceId, workspaceId));
    assert.deepEqual(after, before, "GET must not rewrite any message or snapshot");
    const legacy = after.find(m => m.id === legacyId)!;
    assert.equal(legacy.content, "Jawaban lama tetap utuh.");
    assert.equal(legacy.createdAt.toISOString(), legacyTime.toISOString());
    assert.equal(legacy.referenceSnapshot, null);
  } finally {
    references[0] = sourceBefore;
    provider.mock.restore();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await db.delete(lktOrganizations).where(eq(lktOrganizations.id, orgId));
    await db.delete(lktAiUsage).where(inArray(lktAiUsage.key, [`account:${userId}`, `organization:${orgId}`]));
    await pool.end();
  }
});
