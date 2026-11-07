import { test } from "node:test";
import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import express from "express";
import { db, pool, lktEvidenceArchives, type LktEvidenceArchive } from "@workspace/db";
import { GetReferencesResponse } from "@workspace/api-zod";
import { references } from "./lkt-content";
import { archiveFile, attachEvidenceArchives, checkArchiveBytes, evidenceHash, linkedEvent, publicEvidenceUrl, sha256, snapshotHash, verifyArchiveBytes } from "./lkt-evidence-archive";
import { createReferenceSnapshot } from "./lkt-consultation-snapshot";
import archiveRouter from "../routes/lkt-evidence-archives";
import { initialEvidenceArchives, provisionInitialEvidenceArchives } from "./lkt-evidence-provision";

const reference = references.find(r => r.id === "kemenkum-rupst")!;
const event = reference.reviewHistory[1];
const source = event.primarySources[3];
const bytes = Buffer.from("Kutipan publik pengumuman AHU");
const fixture: LktEvidenceArchive = {
  id: "a".repeat(64), referenceId: reference.id, snapshotHash: snapshotHash(event), evidenceHash: evidenceHash(source),
  sourceUrl: source.url, locator: source.locator, reviewedAt: event.recordedAt,
  capturedAt: new Date("2026-11-07T00:00:00Z"), checksum: sha256(bytes), objectPath: `evidence-archives/${"a".repeat(64)}`,
  contentType: "text/plain", byteLength: bytes.length, description: "Kutipan caption, bukan seluruh carousel.",
};

test("archives attach only to exact retained findings and never promote verification or change AI context", () => {
  const before = JSON.stringify(references);
  const result = attachEvidenceArchives(references, [fixture]);
  const actual = result.find(r => r.id === reference.id)!;
  assert.equal(actual.reviewHistory[0].archives, undefined);
  assert.equal(actual.reviewHistory[1].archives?.length, 1);
  assert.equal(actual.url, reference.url);
  assert.equal(actual.verificationStatus, reference.verificationStatus);
  assert.equal(actual.reviewedAt, reference.reviewedAt);
  assert.deepEqual(actual.primarySources, reference.primarySources);
  assert.equal(createReferenceSnapshot(result).knowledgeVersion, createReferenceSnapshot(references).knowledgeVersion);
  assert.equal(JSON.stringify(references), before);
  assert.equal(GetReferencesResponse.parse(result).find(r => r.id === reference.id)?.reviewHistory[1].archives?.length, 1);
  assert.equal(snapshotHash({ ...event, archives: actual.reviewHistory[1].archives }), snapshotHash(event));
  for (const patch of [
    { referenceId: "legalmp" }, { snapshotHash: "b".repeat(64) }, { evidenceHash: "c".repeat(64) },
    { sourceUrl: "https://www.instagram.com/p/Other/" }, { reviewedAt: "2026-11-05" }, { locator: "salah" },
  ]) assert.equal(linkedEvent(reference, { ...fixture, ...patch }), undefined);
});

test("only curated public origins and safe evidence formats; no signed URL, raw page or cookie", () => {
  assert.equal(publicEvidenceUrl(source.url), true);
  for (const url of ["http://localhost/a", "https://127.0.0.1/a", "https://www.instagram.com/accounts/login/",
    `${source.url}?token=abc`, "https://user:pw@portal.ahu.go.id/a", "https://cdninstagram.com/a?sig=abc",
    "https://portal.ahu.go.id.evil.test/a"]) assert.equal(publicEvidenceUrl(url), false, url);
  checkArchiveBytes(bytes, "text/plain");
  for (const text of ["<html>full account page", "Set-Cookie: a=b", "sessionid=secret",
    "https://cdn.example/a?X-Amz-Signature=secret", "https://cdn.example/a?token=secret"]) {
    assert.throws(() => checkArchiveBytes(Buffer.from(text), "text/plain"));
  }
  assert.throws(() => checkArchiveBytes(Buffer.from("fake PDF"), "application/pdf"));
  assert.throws(() => checkArchiveBytes(Buffer.alloc(0), "text/plain"));
  assert.throws(() => archiveFile("../private"));
  verifyArchiveBytes(bytes, fixture);
  assert.throws(() => verifyArchiveBytes(Buffer.from("Bukti diganti"), fixture), /Checksum/);
  assert.throws(() => verifyArchiveBytes(bytes, { ...fixture, checksum: "b".repeat(64) }), /Checksum/);
  assert.throws(() => verifyArchiveBytes(bytes, { ...fixture, byteLength: 1 }), /Checksum/);
});

test("durable history linkage, append-only metadata and fail-closed download", async () => {
  const schema = `archive_test_${randomUUID().replaceAll("-", "")}`;
  const connection = await pool.connect();
  await connection.query(`CREATE SCHEMA "${schema}"`);
  await connection.query(`SET search_path TO "${schema}"`);
  const onConnect = (client: { query: (q: string) => unknown }) => { void client.query(`SET search_path TO "${schema}"`); };
  pool.on("connect", onConnect);
  for (const name of ["lkt-editorial", "lkt-evidence-archives"]) {
    await connection.query(await readFile(new URL(`../../../../lib/db/migrations/${name}.sql`, import.meta.url), "utf8"));
  }
  connection.release();
  const app = express();
  app.use((req, _res, next) => { Object.assign(req, { log: { error: () => {} } }); next(); });
  app.use("/api", archiveRouter);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const port = (server.address() as { port: number }).port;
  const get = (id: string) => fetch(`http://127.0.0.1:${port}/api/lkt/evidence-archives/${id}`);
  try {
    // A clean database is restored from the real curated App Storage objects.
    // Missing/corrupt objects must never create a partial metadata seed.
    assert.equal(initialEvidenceArchives.length, 35);
    await assert.rejects(provisionInitialEvidenceArchives(db, async () => { throw new Error("Missing object"); }));
    assert.equal((await db.select().from(lktEvidenceArchives)).length, 0);
    await assert.rejects(provisionInitialEvidenceArchives(db, async () => Buffer.from("Corrupt source")));
    assert.equal((await db.select().from(lktEvidenceArchives)).length, 0);
    const cache = new Map<string, Buffer>();
    const load = async (row: LktEvidenceArchive) => {
      const cached = cache.get(row.id);
      if (cached) return cached;
      const [body] = await archiveFile(row.objectPath).download();
      cache.set(row.id, body);
      return body;
    };
    assert.equal(await provisionInitialEvidenceArchives(db, load), 35);
    assert.equal(await provisionInitialEvidenceArchives(db, load), 0, "repeatable without rewriting capturedAt or history");
    for (const id of [
      "c5be7046251583a5ea3dd6383f7918edfbc1aa9c020ea5ddfd134479b0b80f3b",
      "e758e54c28ffbd99b322b92762be72ebb922af5d9cc8ca840b2adc5dcc5eecf4",
      "f1c41e07201b0ded64d908a2d1c503884eb1da09aecbe9825004f973d702e870",
    ]) {
      const response = await get(id);
      assert.equal(response.status, 200, `documented link ${id}`);
      const archived = Buffer.from(await response.arrayBuffer());
      const record = initialEvidenceArchives.find(row => row.id === id)!;
      verifyArchiveBytes(archived, record);
      assert.equal(response.headers.get("x-evidence-sha256"), record.checksum);
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    }
    await assert.rejects(provisionInitialEvidenceArchives(db, load, [
      { ...initialEvidenceArchives[0], checksum: "b".repeat(64) },
    ]), /metadata conflict/);
    await db.insert(lktEvidenceArchives).values(fixture);
    assert.equal((await get("bad-id")).status, 400);
    assert.equal((await get("b".repeat(64))).status, 404);
    // Valid journal relation, missing object: never redirect to the source or return corrupt bytes.
    assert.equal((await get(fixture.id)).status, 503);
    const stored = await db.select().from(lktEvidenceArchives);
    assert.equal(stored.find(row => row.id === fixture.id)?.checksum, fixture.checksum);
    assert.ok(linkedEvent(reference, stored.find(row => row.id === fixture.id)!));
    for (const command of ["UPDATE lkt_evidence_archives SET description='changed'", "DELETE FROM lkt_evidence_archives", "TRUNCATE lkt_evidence_archives"]) {
      await assert.rejects(pool.query(command), /append-only/);
    }
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await pool.query(`DROP SCHEMA "${schema}" CASCADE`);
    pool.off("connect", onConnect);
    await pool.end();
  }
});
