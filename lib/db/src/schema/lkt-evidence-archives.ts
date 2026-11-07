import { pgTable, text, integer, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// Separate append-only attachments: never rewrite a historical editorial snapshot.
export const lktEvidenceArchives = pgTable("lkt_evidence_archives", {
  id: text("id").primaryKey(),
  referenceId: text("reference_id").notNull(),
  snapshotHash: text("snapshot_hash").notNull(),
  evidenceHash: text("evidence_hash").notNull(),
  sourceUrl: text("source_url").notNull(),
  locator: text("locator").notNull(),
  reviewedAt: date("reviewed_at", { mode: "string" }).notNull(),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
  checksum: text("checksum").notNull(),
  objectPath: text("object_path").notNull(),
  contentType: text("content_type").notNull(),
  byteLength: integer("byte_length").notNull(),
  description: text("description").notNull(),
});
export const insertLktEvidenceArchiveSchema = createInsertSchema(lktEvidenceArchives);
export type LktEvidenceArchive = typeof lktEvidenceArchives.$inferSelect;
