import { createHash } from "node:crypto";
import type { PrimaryEvidence, Reference, ReferenceReviewEvent, EvidenceArchive } from "@workspace/api-zod";
import type { LktEvidenceArchive } from "@workspace/db";
import { objectStorageClient, ObjectStorageService } from "./objectStorage";

export const sha256 = (bytes: string | Buffer): string => createHash("sha256").update(bytes).digest("hex");
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).filter(([key, v]) => key !== "archives" && v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
export const snapshotHash = (event: ReferenceReviewEvent): string => sha256(canonical(event));
export const evidenceHash = (source: PrimaryEvidence): string => sha256(canonical(source));

// No signed CDN URLs, credentials, query tokens, arbitrary private hosts or account pages.
export function publicEvidenceUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash
      && (/^(peraturan\.bpk\.go\.id|(?:www\.)?ojk\.go\.id|jdih\.kemenkeu\.go\.id|web\.iaiglobal\.or\.id|jdih\.kemendag\.go\.id|www\.pajak\.go\.id|portal\.ahu\.go\.id)$/.test(url.hostname)
        || (url.hostname === "www.instagram.com" && /^\/p\/[A-Za-z0-9_-]+\/$/.test(url.pathname)));
  } catch { return false; }
}

export function linkedEvent(reference: Reference, archive: Pick<LktEvidenceArchive, "referenceId" | "snapshotHash" | "evidenceHash" | "sourceUrl" | "locator" | "reviewedAt">) {
  if (reference.id !== archive.referenceId || !publicEvidenceUrl(archive.sourceUrl)) return undefined;
  return reference.reviewHistory.find(event => event.recordedAt === archive.reviewedAt
    && snapshotHash(event) === archive.snapshotHash
    && event.primarySources.some(source => evidenceHash(source) === archive.evidenceHash
      && source.url === archive.sourceUrl && source.locator === archive.locator));
}

export function attachEvidenceArchives(references: Reference[], rows: LktEvidenceArchive[]): Reference[] {
  return references.map(reference => ({
    ...reference,
    reviewHistory: reference.reviewHistory.map(event => {
      const linked = rows.filter(row => linkedEvent(reference, row) === event);
      if (!linked.length) return event;
      return {
        ...event,
        archives: linked.map(({ objectPath: _path, referenceId: _ref, capturedAt, ...row }) => ({
          ...row, capturedAt: capturedAt.toISOString(),
        } as EvidenceArchive)),
      };
    }),
  }));
}

// Private bucket namespace; only the curated ID route can publish these bytes.
export function archiveFile(objectPath: string, storageRoot?: string) {
  if (!/^evidence-archives\/[a-f0-9]{64}$/.test(objectPath)) throw new Error("Invalid archive object path");
  const root = (storageRoot ?? new ObjectStorageService().getPrivateObjectDir()).replace(/\/$/, "");
  const match = /^\/([^/]+)\/(.+)$/.exec(`${root}/${objectPath}`);
  if (!match) throw new Error("Invalid App Storage root");
  return objectStorageClient.bucket(match[1]).file(match[2]);
}

export function checkArchiveBytes(bytes: Buffer, contentType: string): void {
  if (!bytes.length || bytes.length > 20_000_000) throw new Error("Bukti kosong atau melebihi 20 MB.");
  const valid = contentType === "application/pdf" ? bytes.subarray(0, 5).toString() === "%PDF-"
    : contentType === "image/png" ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : contentType === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : contentType === "text/plain" && !bytes.includes(0) && Buffer.from(bytes.toString("utf8")).equals(bytes);
  if (!valid) throw new Error("Hanya kutipan teks UTF-8, PDF atau gambar PNG/JPEG yang diperiksa.");
  if (contentType === "text/plain" && /(?:<script|<html|set-cookie|(?:access_token|authorization|sessionid)\s*[:=]|https?:\/\/\S+\?(?:\S*(?:signature|token|expires|x-amz-|x-goog-)))/i.test(bytes.toString("utf8"))) {
    throw new Error("Bukti mengandung HTML mentah, cookie atau URL bertanda tangan; simpan hanya bagian publik yang relevan.");
  }
}

export function verifyArchiveBytes(bytes: Buffer, archive: Pick<LktEvidenceArchive, "contentType" | "byteLength" | "checksum">): void {
  checkArchiveBytes(bytes, archive.contentType);
  if (bytes.length !== archive.byteLength || sha256(bytes) !== archive.checksum) throw new Error("Checksum mismatch");
}
