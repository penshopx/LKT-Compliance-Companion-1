import { strict as assert } from "node:assert";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import express, { type ErrorRequestHandler } from "express";
import { eq, inArray } from "drizzle-orm";
import { db, pool, lktOrganizations, lktMemberships, lktWorkspaces, lktMessages, lktAiUsage } from "@workspace/db";
import { AskConsultantBody, AskConsultantResponse, GetMessagesResponse, GetConsultationSpecialistsResponse } from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import consultationRouter from "../routes/lkt-consultation";
import { references } from "./lkt-content";
import { consultationReferenceContext, createReferenceSnapshot, referenceFreshness } from "./lkt-consultation-snapshot";
import { defaultProfile } from "./lkt-workspace";
import messageHistoryRouter from "../routes/lkt-message-history";
import { LktAccessError } from "./lkt-ai-limits";
import { consultationSpecialists, consultationSpecialistInstruction } from "./lkt-consultation-specialists";

test("specialist catalog is bounded, shares one consultation and rejects unsupported focus", () => {
  const catalog = GetConsultationSpecialistsResponse.parse(consultationSpecialists);
  assert.deepEqual(catalog.map(p => p.id), ["umum", "akuntansi", "perpajakan", "tahunan_rups"]);
  for (const profile of catalog) {
    assert.ok(profile.starters.length >= 2);
    assert.ok(profile.boundary.length > 40);
    assert.match(consultationSpecialistInstruction(profile.id), /bukan model yang dilatih khusus/);
    assert.ok(consultationSpecialistInstruction(profile.id).includes(profile.label));
  }
  assert.equal(AskConsultantBody.safeParse({ content: "Pertanyaan", specialist: "auditor_bersertifikat" }).success, false);
  assert.equal(AskConsultantBody.safeParse({ content: "Pertanyaan" }).success, true, "old clients retain general focus");
});

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
  app.use(messageHistoryRouter);
  app.use(consultationRouter);
  const accessErrors: ErrorRequestHandler = (error, _req, res, next) => {
    if (!(error instanceof LktAccessError)) { next(error); return; }
    res.status(error.status).json({ error: error.message });
  };
  app.use(accessErrors);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.on("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/lkt/messages`;
  const prompts: string[] = [];
  // Stub only the external provider; run the actual POST, authorization, storage,
  // and fresh GET paths. No model credits or user data are used by this test.
  const provider = t.mock.method(openai.chat.completions, "create", async (input: { messages: { role: string; content: string }[] }) => {
    prompts.push(input.messages[0].content);
    assert.ok(input.messages[0].content.includes(JSON.stringify(consultationReferenceContext(references))));
    assert.match(input.messages[0].content, /ikuti status dan batas temuan djp-spt pada catatan peninjauan aktif/);
    assert.doesNotMatch(input.messages[0].content, /PER-12\/PJ\/2026 yang belum diverifikasi penuh/);
    assert.match(input.messages[0].content, /Jangan menetapkan tarif atau tenggat individual otomatis/);
    assert.ok(input.messages.some(m => m.role === "assistant" && m.content.includes("[Jawaban historis:")));
    return { choices: [{ message: { content: "Jawaban baru untuk pengujian snapshot." } }] };
  });
  try {
    await db.insert(lktOrganizations).values({ id: orgId, name: "Snapshot isolated fixture" });
    await db.insert(lktMemberships).values({ organizationId: orgId, userId, role: "owner" });
    await db.insert(lktWorkspaces).values({ id: workspaceId, organizationId: orgId, profile: defaultProfile });
    await db.insert(lktMessages).values({ id: legacyId, workspaceId, role: "assistant", content: "Jawaban lama tetap utuh.", createdAt: legacyTime });
    const catalog = await fetch(`http://127.0.0.1:${address.port}/lkt/consultation-specialists`);
    assert.equal(catalog.status, 200);
    assert.equal(GetConsultationSpecialistsResponse.parse(await catalog.json()).length, 4);
    const invalid = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Jangan proses fokus ini", specialist: "tidak_dikenal" }) });
    assert.equal(invalid.status, 400);
    assert.equal(provider.mock.callCount(), 0);
    const response = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: "Pertanyaan snapshot?", specialist: "akuntansi" }) });
    assert.equal(response.status, 200, await response.clone().text());
    const created = AskConsultantResponse.parse(await response.json());
    assert.equal(created.referenceFreshness, "current");
    assert.equal(created.specialist, "akuntansi");
    assert.match(prompts[0], /Fokus yang dipilih untuk pertanyaan SAAT INI: Pendamping Akuntansi/);
    assert.ok(created.referenceSnapshot);
    assert.equal(created.referenceSnapshot.references.length, references.length);
    assert.equal(created.originalQuestion?.content, "Pertanyaan snapshot?");
    assert.equal(provider.mock.callCount(), 1);
    const reload = async () => GetMessagesResponse.parse(await (await fetch(base)).json()).messages;
    const loaded = await reload();
    assert.equal(loaded.find(m => m.id === legacyId)?.referenceFreshness, "missing");
    assert.equal(loaded.find(m => m.id === legacyId)?.specialist, null, "legacy focus must not be invented");
    assert.equal(loaded.find(m => m.role === "user")?.specialist, "akuntansi");
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
    // Reusing a question goes through the normal authorized, metered POST. It
    // appends a fresh pair and leaves the old answer and its warning intact.
    const repeated = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: created.originalQuestion!.content, specialist: "perpajakan" }) });
    assert.equal(repeated.status, 200, await repeated.clone().text());
    const fresh = AskConsultantResponse.parse(await repeated.json());
    assert.notEqual(fresh.id, created.id);
    assert.notEqual(fresh.originalQuestion?.id, created.originalQuestion?.id);
    assert.equal(fresh.referenceFreshness, "current");
    assert.equal(fresh.specialist, "perpajakan");
    assert.match(prompts[1], /Fokus yang dipilih untuk pertanyaan SAAT INI: Pendamping Perpajakan/);
    assert.equal((await reload()).find(m => m.id === created.id)?.specialist, "akuntansi", "changing focus never relabels old answers");
    assert.notEqual(fresh.referenceSnapshot?.knowledgeVersion, created.referenceSnapshot.knowledgeVersion);
    const final = await reload();
    assert.deepEqual(final.find(m => m.id === created.id), changed.find(m => m.id === created.id));
    assert.equal(final.length, loaded.length + 2);
    const usage = await db.select().from(lktAiUsage).where(eq(lktAiUsage.key, `account:${userId}`));
    assert.equal(usage[0].count, 2, "repeated question counts as a normal new consultation");
    await db.update(lktAiUsage).set({ count: 12 }).where(eq(lktAiUsage.key, `account:${userId}`));
    const limited = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: created.originalQuestion!.content }) });
    assert.equal(limited.status, 429);
    assert.equal(provider.mock.callCount(), 2, "rate-limited resend must not reach provider");
    assert.equal((await reload()).length, final.length);
    await db.delete(lktMemberships).where(eq(lktMemberships.organizationId, orgId));
    const denied = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: created.originalQuestion!.content }) });
    assert.equal(denied.status, 403);
    assert.equal(provider.mock.callCount(), 2, "denied resend must not reach provider");
    assert.equal((await reload()).length, final.length);
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
