import { db, lktEvidenceArchives, type LktEvidenceArchive } from "@workspace/db";
import initialMetadata from "../data/evidence-archives.initial.json";
import { references } from "./lkt-content";
import { archiveFile, linkedEvent, verifyArchiveBytes } from "./lkt-evidence-archive";

// Metadata only. Byte payloads remain exclusively in App Storage.
export const initialEvidenceArchives: LktEvidenceArchive[] = initialMetadata.map(row => ({
  ...row, capturedAt: new Date(row.capturedAt),
}));

export function archiveMetadataMatches(actual: LktEvidenceArchive, expected: LktEvidenceArchive): boolean {
  return (Object.keys(expected) as (keyof LktEvidenceArchive)[]).every(key =>
    key === "capturedAt" ? actual.capturedAt.toISOString() === expected.capturedAt.toISOString()
      : actual[key] === expected[key]);
}

/**
 * Trusted startup/operator procedure, never an HTTP mutation. A fresh DB is
 * restored only from already archived, checksum-validated bytes, not live URLs.
 * No partial metadata insertion if a source object is unavailable/corrupt.
 */
export async function provisionInitialEvidenceArchives(
  database: typeof db = db,
  loadBytes: (row: LktEvidenceArchive) => Promise<Buffer> = async row => (await archiveFile(row.objectPath).download())[0],
  records: LktEvidenceArchive[] = initialEvidenceArchives,
): Promise<number> {
  for (const row of records) {
    if (!references.some(reference => linkedEvent(reference, row))) throw new Error("Initial archive is not linked to retained findings");
  }
  const existing = await database.select().from(lktEvidenceArchives);
  for (const row of records) {
    const found = existing.find(item => item.id === row.id);
    if (found && !archiveMetadataMatches(found, row)) throw new Error("Initial archive metadata conflict; existing history was not overwritten");
  }
  const missing = records.filter(row => !existing.some(item => item.id === row.id));
  // Also verify an already populated database against this environment's bucket.
  // Restoring DB metadata alone must not silently point at an empty new bucket.
  for (let i = 0; i < records.length; i += 4) {
    await Promise.all(records.slice(i, i + 4).map(async row => verifyArchiveBytes(await loadBytes(row), row)));
  }
  if (missing.length) {
    await database.transaction(async tx => {
      await tx.insert(lktEvidenceArchives).values(missing).onConflictDoNothing();
      const restored = await tx.select().from(lktEvidenceArchives);
      if (records.some(row => !restored.some(item => item.id === row.id && archiveMetadataMatches(item, row)))) {
        throw new Error("Initial archive restoration conflict");
      }
    });
  }
  return missing.length;
}
