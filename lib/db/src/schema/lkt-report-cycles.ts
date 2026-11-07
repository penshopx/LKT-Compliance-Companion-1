import { pgTable, text, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { lktWorkspaces } from "./lkt-workspaces";

export const lktReportCycles = pgTable("lkt_report_cycles", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => lktWorkspaces.id, { onDelete: "cascade" }),
  year: integer("year").notNull(),
  kind: text("kind").$type<"nonpublik" | "umkm" | "publik" | "kjpp">().notNull(),
  standard: text("standard").$type<"Belum ditentukan" | "SAK EMKM" | "SAK Entitas Privat" | "SAK Indonesia">().notNull(),
  legalForm: text("legal_form").$type<"belum_ditentukan" | "pt_modal" | "pt_perorangan" | "selain_pt">().notNull(),
  coordinator: text("coordinator").notNull().default(""),
  notes: text("notes").notNull().default(""),
  revision: integer("revision").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("lkt_report_workspace_year").on(t.workspaceId, t.year)]);

export const insertLktReportCycleSchema = createInsertSchema(lktReportCycles).omit({ createdAt: true, updatedAt: true });
export type LktReportCycle = typeof lktReportCycles.$inferSelect;
export type InsertLktReportCycle = typeof lktReportCycles.$inferInsert;
