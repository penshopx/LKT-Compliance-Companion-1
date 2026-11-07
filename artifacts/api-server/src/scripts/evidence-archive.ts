import { readFile } from "node:fs/promises";
import { db, pool, lktEvidenceArchives } from "@workspace/db";
import { getEditorialReferences } from "../lib/lkt-editorial";
import { archiveFile, checkArchiveBytes, evidenceHash, linkedEvent, publicEvidenceUrl, sha256, snapshotHash } from "../lib/lkt-evidence-archive";

// Operator-only, no remote URL fetch or upload endpoint. Review the local file first.
// list | save[-related] <referenceId> <revision> <sourceIndex> <file> <mime> <description> --confirm-public-material
try {
  const [command, referenceId, revision, sourceIndex, path, contentType, description, confirm] = process.argv.slice(2);
  const references = await getEditorialReferences();
  if (command === "audit") {
    const rows = await db.select().from(lktEvidenceArchives);
    const orphans = rows.filter(row => !references.some(reference => linkedEvent(reference, row)));
    const missing = references.flatMap(reference => reference.reviewHistory.flatMap((event, i) =>
      event.kind === "schedule" ? [] : event.primarySources.filter(source =>
        !rows.some(row => row.referenceId === reference.id && row.snapshotHash === snapshotHash(event) && row.evidenceHash === evidenceHash(source)))
        .map(source => ({ referenceId: reference.id, revision: i + 1, sourceUrl: source.url }))));
    process.stdout.write(JSON.stringify({ total: rows.length, orphanIds: orphans.map(row => row.id), missing,
      archives: rows.map(row => ({ referenceId: row.referenceId, id: row.id, sourceUrl: row.sourceUrl, checksum: row.checksum })) }, null, 2) + "\n");
    if (orphans.length || missing.length) process.exitCode = 1;
  } else if (command === "list") {
    for (const reference of references) reference.reviewHistory.forEach((event, i) => {
      if (event.kind === "schedule") return;
      event.primarySources.forEach((source, j) => {
        process.stdout.write(`${reference.id}\t${i + 1}\t${j}\t${source.url}\t${source.locator}\n`);
      });
    });
  } else {
    if (!["save", "save-related"].includes(command) || confirm !== "--confirm-public-material" || !description?.trim() || description.length > 2000) {
      throw new Error("Gunakan list, atau save[-related] <referenceId> <revision> <sourceIndex> <file> <mime> <description> --confirm-public-material. Konfirmasi: hanya bukti publik yang relevan; tanpa data akun, cookie, URL CDN bertanda tangan atau materi standar berlisensi.");
    }
    const reference = references.find(r => r.id === referenceId);
    const event = reference?.reviewHistory[Number(revision) - 1];
    const source = event?.primarySources[Number(sourceIndex)];
    if (!reference || !event || event.kind === "schedule" || !source || !publicEvidenceUrl(source.url)) {
      throw new Error("Pilih snapshot temuan dan sumber publik resmi yang sudah dicatat, bukan jadwal saja.");
    }
    const bytes = await readFile(path);
    checkArchiveBytes(bytes, contentType);
    const checksum = sha256(bytes);
    const targets = command === "save-related" ? references.flatMap(r => r.reviewHistory
      .filter(e => e.kind !== "schedule" && e.primarySources.some(s => evidenceHash(s) === evidenceHash(source)))
      .map(e => ({ reference: r, event: e }))) : [{ reference, event }];
    for (const { reference, event } of targets) {
    const eventHash = snapshotHash(event);
    const sourceHash = evidenceHash(source);
    const id = sha256(`${reference.id}:${eventHash}:${sourceHash}:${checksum}:${description.trim()}`);
    const objectPath = `evidence-archives/${id}`;
    const file = archiveFile(objectPath);
    // Create-only objects: a repeat can verify but cannot overwrite original bytes.
    try {
      await file.save(bytes, { resumable: false, contentType, preconditionOpts: { ifGenerationMatch: 0 } });
    } catch (error) {
      if ((error as { code?: number }).code !== 412) throw new Error("Penyimpanan App Storage gagal.");
    }
    const [stored] = await file.download();
    if (sha256(stored) !== checksum) throw new Error("Checksum App Storage tidak cocok; arsip tidak ditautkan.");
    await db.insert(lktEvidenceArchives).values({
      id, referenceId: reference.id, snapshotHash: eventHash, evidenceHash: sourceHash,
      sourceUrl: source.url, locator: source.locator, reviewedAt: event.recordedAt,
      capturedAt: new Date(), checksum, objectPath, contentType, byteLength: bytes.length,
      description: description.trim(),
    }).onConflictDoNothing();
    process.stdout.write(`Arsip tersimpan: ${reference.id}; ${id}; SHA-256 ${checksum}. Status temuan tidak berubah.\n`);
    }
  }
} catch (error) {
  // Never print provider errors, signed URLs, local file contents or credentials.
  process.stderr.write(error instanceof Error && !("code" in error) ? `${error.message}\n` : "Pencatatan arsip gagal.\n");
  process.exitCode = 1;
} finally { await pool.end(); }
