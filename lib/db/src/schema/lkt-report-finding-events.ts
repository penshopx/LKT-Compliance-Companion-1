import { integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { lktReportFindings } from "./lkt-report-findings";

export const lktReportFindingEvents = pgTable("lkt_report_finding_events", {
  id: text("id").primaryKey(),
  findingId: text("finding_id").notNull().references(() => lktReportFindings.id, { onDelete: "cascade" }),
  revision: integer("revision").notNull(),
  actorUserId: text("actor_user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
}, t => [uniqueIndex("lkt_finding_event_revision").on(t.findingId, t.revision)]);
export const insertLktReportFindingEventSchema = createInsertSchema(lktReportFindingEvents);
export type LktReportFindingEvent = typeof lktReportFindingEvents.$inferSelect;
