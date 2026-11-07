import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { lktWorkspaces } from "./lkt-workspaces";

export type LktReferenceSnapshot = {
  capturedAt: string;
  knowledgeVersion: string;
  references: {
    id: string;
    title: string;
    reviewedAt: string;
    verificationStatus: "verified_primary" | "reviewed_secondary" | "needs_review" | "outdated" | "unavailable";
  }[];
};

export const lktMessages = pgTable("lkt_messages", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => lktWorkspaces.id, { onDelete: "cascade" }),
  role: text("role").$type<"user" | "assistant">().notNull(),
  content: text("content").notNull(),
  // NULL preserves the honest absence of focus attribution in legacy history.
  specialist: text("specialist").$type<"umum" | "akuntansi" | "perpajakan" | "tahunan_rups">(),
  referenceSnapshot: jsonb("reference_snapshot").$type<LktReferenceSnapshot>(),
  reconsultedFromId: text("reconsulted_from_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
export const insertLktMessageSchema = createInsertSchema(lktMessages);
export type LktMessage = typeof lktMessages.$inferSelect;
