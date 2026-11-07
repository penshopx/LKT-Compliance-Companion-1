import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { randomUUID } from "node:crypto";
import express from "express";
import { and, eq, inArray } from "drizzle-orm";
import { db, pool, lktOrganizations, lktMemberships, lktWorkspaces, lktMessages, lktAiUsage, lktAiLeases } from "@workspace/db";
import { AskConsultantResponse, GetConsultationMessageResponse, GetMessagesResponse } from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import lktRouter from "../routes/lkt";
import { LktAccessError } from "./lkt-ai-limits";
import { defaultProfile } from "./lkt-workspace";
import { createReferenceSnapshot } from "./lkt-consultation-snapshot";

test("explicit reconsultation preserves history, company boundaries, authorization and quota", async () => {
  const user = `reconsult-${randomUUID()}`;
  const orgs = [randomUUID(), randomUUID()];
  const workspaces = [randomUUID(), randomUUID()];
  const sourceId = randomUUID(), foreignId = randomUUID(), questionId = randomUUID();
  let calls = 0;
  let revoke = false;
  const ai = mock.method(openai.chat.completions, "create", async () => {
    calls++;
    if (revoke) await db.delete(lktMemberships).where(and(eq(lktMemberships.organizationId, orgs[0]), eq(lktMemberships.userId, user)));
    return { choices: [{ message: { content: "Hasil konsultasi ulang; tetap perlu verifikasi." } }] };
  });
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    Object.assign(req, {
      auth: Object.assign(() => ({ userId: req.get("test-user") ?? null, tokenType: "session_token" }),
        { [Symbol.for("@clerk/express.auth")]: true }),
      log: { error() {} },
    });
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
  const base = `http://127.0.0.1:${address.port}/api/lkt/messages`;
  const call = (path = "", body?: unknown, identity: string | null = user, organization = orgs[0]) => fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", "X-LKT-Organization": organization, ...(identity ? { "test-user": identity } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const usageKeys = [`account:${user}`, ...orgs.map(id => `organization:${id}`)];
  try {
    await db.insert(lktOrganizations).values(orgs.map(id => ({ id, name: "Reconsultation test" })));
    await db.insert(lktMemberships).values(orgs.map(organizationId => ({ organizationId, userId: user, role: "owner" as const })));
    await db.insert(lktWorkspaces).values(workspaces.map((id, i) => ({ id, organizationId: orgs[i], profile: defaultProfile })));
    await db.insert(lktMessages).values([
      { id: questionId, workspaceId: workspaces[0], role: "user", content: "Pertanyaan asal", createdAt: new Date("2026-01-01") },
      { id: sourceId, workspaceId: workspaces[0], role: "assistant", content: "Jawaban lama", referenceSnapshot: createReferenceSnapshot([]), createdAt: new Date("2026-01-02") },
      { id: foreignId, workspaceId: workspaces[1], role: "assistant", content: "Rahasia perusahaan lain" },
    ]);
    const [sourceBefore] = await db.select().from(lktMessages).where(eq(lktMessages.id, sourceId));
    for (const source of [foreignId, questionId, "missing"]) {
      assert.equal((await call("", { content: "Ulang", reconsultedFromId: source })).status, 404);
    }
    assert.equal(calls, 0, "invalid origins never call AI");
    assert.equal((await db.select().from(lktAiUsage).where(inArray(lktAiUsage.key, usageKeys))).length, 0, "invalid origins do not consume quota");
    assert.equal((await call(`/${foreignId}`)).status, 404);
    assert.equal((await call(`/${sourceId}`, undefined, null)).status, 401);
    assert.equal((await call("", { content: "Ulang", reconsultedFromId: sourceId }, "outsider")).status, 403);
    const response = await call("", { content: "Pertanyaan yang disunting", specialist: "perpajakan", reconsultedFromId: sourceId });
    assert.equal(response.status, 200, await response.clone().text());
    const answer = AskConsultantResponse.parse(await response.json());
    assert.equal(answer.reconsultedFromId, sourceId);
    assert.equal(answer.specialist, "perpajakan");
    assert.equal(answer.originalQuestion?.content, "Pertanyaan yang disunting");
    const persisted = GetConsultationMessageResponse.parse(await (await call(`/${answer.id}`)).json());
    assert.deepEqual(persisted, answer, "origin persists across independent reloads");
    const source = GetConsultationMessageResponse.parse(await (await call(`/${sourceId}`)).json());
    assert.deepEqual(source.reconsultationIds, [answer.id], "origin opens the new answer too");
    assert.equal(source.reconsultedFromId, null, "legacy origins are never inferred");
    assert.deepEqual((await db.select().from(lktMessages).where(eq(lktMessages.id, sourceId)))[0], sourceBefore);
    const filtered = GetMessagesResponse.parse(await (await call("?q=Jawaban%20lama&limit=1")).json());
    assert.deepEqual(filtered.messages[0].reconsultationIds, [answer.id], "links work outside search and pagination");
    const ordinary = await call("", { content: "Pertanyaan terpisah" });
    assert.equal(ordinary.status, 200);
    assert.equal(AskConsultantResponse.parse(await ordinary.json()).reconsultedFromId, null);
    const accountUsage = (await db.select().from(lktAiUsage).where(eq(lktAiUsage.key, `account:${user}`)))[0];
    assert.equal(accountUsage.count, 2, "linked and normal sends use the same quota");
    await db.update(lktAiUsage).set({ count: 12 }).where(eq(lktAiUsage.key, `account:${user}`));
    assert.equal((await call("", { content: "Ulang", reconsultedFromId: sourceId })).status, 429);
    assert.equal(calls, 2);
    await db.update(lktAiUsage).set({ count: 2 }).where(eq(lktAiUsage.key, `account:${user}`));
    revoke = true;
    assert.equal((await call("", { content: "Akses dicabut saat AI berjalan", reconsultedFromId: sourceId })).status, 403);
    assert.equal((await db.select().from(lktMessages).where(eq(lktMessages.workspaceId, workspaces[0]))).length, 6, "revoked send stores neither question nor answer");
    assert.equal((await db.select().from(lktAiLeases).where(eq(lktAiLeases.organizationId, orgs[0]))).length, 0);
    await db.insert(lktMemberships).values({ organizationId: orgs[0], userId: user, role: "owner" });
    await db.delete(lktMessages).where(eq(lktMessages.workspaceId, workspaces[0]));
    assert.equal((await call(`/${answer.id}`)).status, 404);
    assert.equal((await call("", { content: "Ulang", reconsultedFromId: sourceId })).status, 404);
  } finally {
    ai.mock.restore();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await db.delete(lktOrganizations).where(inArray(lktOrganizations.id, orgs));
    await db.delete(lktAiUsage).where(inArray(lktAiUsage.key, usageKeys));
    await pool.end();
  }
});
