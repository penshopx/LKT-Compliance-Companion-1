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
  referenceSnapshot: jsonb("reference_snapshot").$type<LktReferenceSnapshot>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
export const insertLktMessageSchema = createInsertSchema(lktMessages);
export type LktMessage = typeof lktMessages.$inferSelect;
