import { boolean, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { lktReportCycles } from "./lkt-report-cycles";

export const lktReportFindings = pgTable("lkt_report_findings", {
  id: text("id").primaryKey(),
  reportCycleId: text("report_cycle_id").notNull().references(() => lktReportCycles.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  problem: text("problem").notNull(),
  cause: text("cause").notNull().default(""),
  evidenceNeeded: text("evidence_needed").notNull().default(""),
  actionPlan: text("action_plan").notNull().default(""),
  actionResult: text("action_result").notNull().default(""),
  assignee: text("assignee").notNull().default(""),
  targetDate: text("target_date"),
  priority: text("priority").$type<"rendah" | "sedang" | "tinggi">().notNull(),
  status: text("status").$type<"terbuka" | "proses" | "menunggu_telaah" | "ditutup">().notNull(),
  reviewNote: text("review_note").notNull().default(""),
  sourceDiagnosisId: text("source_diagnosis_id"),
  archived: boolean("archived").notNull().default(false),
  revision: integer("revision").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  closedByUserId: text("closed_by_user_id"),
}, t => [index("lkt_finding_cycle").on(t.reportCycleId)]);

export const insertLktReportFindingSchema = createInsertSchema(lktReportFindings);
export type LktReportFinding = typeof lktReportFindings.$inferSelect;
