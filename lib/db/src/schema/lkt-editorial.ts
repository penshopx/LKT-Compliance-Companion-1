import { pgTable, text, serial, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import type { z } from "zod/v4";

// Global editorial authority: intentionally unrelated to company membership.
export const lktEditors = pgTable("lkt_editors", {
  userId: text("user_id").primaryKey(),
  displayName: text("display_name").notNull(),
});
export const lktEditorialEvents = pgTable("lkt_editorial_events", {
  id: serial("id").primaryKey(),
  referenceId: text("reference_id").notNull(),
  snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [index("lkt_editorial_events_reference_idx").on(table.referenceId, table.id)]);
export const insertLktEditorSchema = createInsertSchema(lktEditors);
export const insertLktEditorialEventSchema = createInsertSchema(lktEditorialEvents).omit({ id: true, createdAt: true });
export type LktEditor = typeof lktEditors.$inferSelect;
export type InsertLktEditorialEvent = z.infer<typeof insertLktEditorialEventSchema>;
