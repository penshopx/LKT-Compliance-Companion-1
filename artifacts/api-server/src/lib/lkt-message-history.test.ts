import { strict as assert } from "node:assert";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import express from "express";
import { asc, eq, sql } from "drizzle-orm";
import { db, pool, lktOrganizations, lktWorkspaces, lktMessages } from "@workspace/db";
import { GetMessagesResponse } from "@workspace/api-zod";
import historyRouter from "../routes/lkt-message-history";
import { defaultProfile } from "./lkt-workspace";
import { createReferenceSnapshot } from "./lkt-consultation-snapshot";
import { getEditorialReferences } from "./lkt-editorial";

test("cursor history spans 205+ messages, preserves precision, isolation, snapshots and reloads", async () => {
  const orgId = `history-test-${randomUUID()}`;
  const workspaceId = randomUUID();
  const otherWorkspace = randomUUID();
  const app = express();
  app.use((req, res, next) => {
    // Authentication/membership is covered separately by test:auth.
    res.locals.workspace = { id: req.header("x-test-other") ? otherWorkspace : workspaceId };
    next();
  });
  app.use(historyRouter);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.on("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/lkt/messages`;
  const read = async (query = "", other = false) => {
    const response = await fetch(`${base}${query}`, { headers: other ? { "x-test-other": "1" } : {} });
    assert.equal(response.status, 200, await response.clone().text());
    return GetMessagesResponse.parse(await response.json());
  };
  try {
    await db.insert(lktOrganizations).values({ id: orgId, name: "History isolated fixture" });
    await db.insert(lktWorkspaces).values([
      { id: workspaceId, organizationId: orgId, profile: defaultProfile },
      // Separate organization is unnecessary for this low-level workspace query test.
      { id: otherWorkspace, profile: defaultProfile },
    ]);
    assert.deepEqual(await read(), { messages: [], nextCursor: null });
    const snapshot = createReferenceSnapshot(await getEditorialReferences());
    const changed = { ...snapshot, knowledgeVersion: "historical-version" };
    const fixtures = Array.from({ length: 205 }, (_, i) => ({
      id: randomUUID(), workspaceId, role: i % 4 === 0 ? "user" as const : "assistant" as const,
      content: `History fixture ${i}`, createdAt: new Date("2026-01-01T00:00:00Z"),
      referenceSnapshot: i % 4 === 1 ? snapshot : i % 4 === 2 ? changed : null,
    }));
    await db.insert(lktMessages).values(fixtures);
    await db.insert(lktMessages).values({ id: randomUUID(), workspaceId: otherWorkspace, role: "user", content: "Other company private message" });
    // Put sub-millisecond timestamps exactly at two page boundaries.
    for (const [i, time] of ["2026-01-02T00:00:00.000111Z", "2026-01-02T00:00:00.000222Z"].entries()) {
      await db.update(lktMessages).set({ createdAt: sql`${time}::timestamptz` }).where(eq(lktMessages.id, fixtures[i].id));
    }
    const stored = await db.select().from(lktMessages).where(eq(lktMessages.workspaceId, workspaceId))
      .orderBy(asc(lktMessages.createdAt), asc(lktMessages.id));
    const firstSingle = await read("?limit=1");
    assert.equal(firstSingle.messages[0].id, fixtures[1].id);
    const secondSingle = await read(`?limit=1&before=${firstSingle.nextCursor}`);
    assert.equal(secondSingle.messages[0].id, fixtures[0].id, "do not truncate cursor timestamp precision");
    const first = await read();
    assert.equal(first.messages.length, 80);
    assert.ok(first.nextCursor);
    assert.deepEqual(await read(), first, "reload first page is deterministic");
    for (const query of ["?limit=0", "?limit=81", "?limit=1.5", "?limit=abc", "?before=", "?before=garbage", "?before[x]=bad", "?before=a&before=b"]) {
      assert.equal((await fetch(`${base}${query}`)).status, 400, query);
    }
    assert.equal((await fetch(`${base}?before=${first.nextCursor}`, { headers: { "x-test-other": "1" } })).status, 400);
    const decoded = JSON.parse(Buffer.from(first.nextCursor, "base64url").toString());
    const forged = Buffer.from(JSON.stringify({ ...decoded, workspace: otherWorkspace })).toString("base64url");
    assert.equal((await fetch(`${base}?before=${forged}`, { headers: { "x-test-other": "1" } })).status, 400);
    assert.equal((await read("", true)).messages.length, 1);

    // A new message must not shift the older cursor or create duplicates.
    const newId = randomUUID();
    await db.insert(lktMessages).values({ id: newId, workspaceId, role: "user", content: "Concurrent new question", createdAt: new Date("2026-01-03") });
    const collect = async (initial = first) => {
      const pages = [initial];
      while (pages.at(-1)!.nextCursor) pages.push(await read(`?before=${pages.at(-1)!.nextCursor}`));
      return pages.reverse().flatMap(p => p.messages);
    };
    const all = await collect();
    assert.equal(all.length, 205);
    assert.equal(new Set(all.map(m => m.id)).size, 205);
    assert.deepEqual(all.map(m => m.id), stored.map(m => m.id));
    for (const message of all) {
      const original = fixtures.find(m => m.id === message.id)!;
      assert.equal(message.content, original.content);
      assert.deepEqual(message.referenceSnapshot, original.referenceSnapshot);
      assert.equal(message.referenceFreshness, original.role === "user" ? "not_applicable"
        : !original.referenceSnapshot ? "missing" : original.referenceSnapshot === snapshot ? "current" : "changed");
    }
    const reloaded = await collect(await read());
    assert.deepEqual(reloaded.map(m => m.id), [...all.map(m => m.id), newId]);
    assert.equal(new Set(reloaded.map(m => m.id)).size, 206);
    assert.deepEqual((await db.select().from(lktMessages).where(eq(lktMessages.workspaceId, workspaceId))
      .orderBy(asc(lktMessages.createdAt), asc(lktMessages.id))).filter(m => m.id !== newId), stored,
    "reads must never rewrite content or snapshots");
    await db.delete(lktMessages).where(eq(lktMessages.id, decoded.id));
    assert.equal((await fetch(`${base}?before=${first.nextCursor}`)).status, 400, "deleted cursor explicitly requires restart");

    // A one-row page must still carry its exact question from the lookahead,
    // not whichever user happens to be visible in the browser.
    await db.delete(lktMessages).where(eq(lktMessages.workspaceId, workspaceId));
    const pairRows = [
      { id: randomUUID(), role: "assistant" as const, content: "Orphan answer" },
      { id: randomUUID(), role: "user" as const, content: "First question\nwith details" },
      { id: randomUUID(), role: "assistant" as const, content: "Legacy answer" },
      { id: randomUUID(), role: "assistant" as const, content: "Another orphan answer" },
      { id: randomUUID(), role: "user" as const, content: "Different question" },
      { id: randomUUID(), role: "assistant" as const, content: "Changed answer", referenceSnapshot: changed },
    ].map((row, i) => ({ ...row, workspaceId, createdAt: new Date(Date.UTC(2026, 0, 4, 0, 0, i)) }));
    await db.insert(lktMessages).values(pairRows);
    let single = await read("?limit=1");
    const singles = [];
    while (true) {
      singles.unshift(single.messages[0]);
      if (!single.nextCursor) break;
      single = await read(`?limit=1&before=${single.nextCursor}`);
    }
    assert.equal(singles.length, pairRows.length);
    assert.deepEqual(singles[5].originalQuestion, { id: pairRows[4].id, content: pairRows[4].content });
    assert.deepEqual(singles[2].originalQuestion, { id: pairRows[1].id, content: pairRows[1].content });
    assert.equal(singles[2].referenceFreshness, "missing");
    assert.equal(singles[5].referenceFreshness, "changed");
    for (const i of [0, 1, 3, 4]) assert.equal(singles[i].originalQuestion, null);
    assert.deepEqual((await read()).messages, singles, "pairing is independent of page size");
    await db.delete(lktMessages).where(eq(lktMessages.id, pairRows[4].id));
    assert.equal((await read("?limit=1")).messages[0].originalQuestion, null, "never skip an orphan assistant to find a question");
    await db.update(lktMessages).set({ createdAt: pairRows[1].createdAt }).where(eq(lktMessages.id, pairRows[2].id));
    assert.equal((await read()).messages.find(m => m.id === pairRows[2].id)?.originalQuestion, null, "ambiguous timestamp ties cannot select a question");
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await db.delete(lktOrganizations).where(eq(lktOrganizations.id, orgId));
    await db.delete(lktWorkspaces).where(eq(lktWorkspaces.id, otherWorkspace));
    await pool.end();
  }
});
