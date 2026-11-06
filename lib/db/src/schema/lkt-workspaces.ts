import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { lktOrganizations } from "./lkt-organizations";

export const lktWorkspaces = pgTable("lkt_workspaces", {
  id: text("id").primaryKey(),
  // NULL means quarantined pre-auth browser data; never load it by account routes.
  organizationId: text("organization_id").unique().references(() => lktOrganizations.id, { onDelete: "cascade" }),
  profile: jsonb("profile").$type<{ name: string; kind: string; year: number; standard: string }>().notNull(),
  tasks: jsonb("tasks").$type<Record<string, {status: string; notes: string}>>().notNull().default({}),
  bookmarks: jsonb("bookmarks").$type<Record<string, boolean>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
export const insertLktWorkspaceSchema = createInsertSchema(lktWorkspaces);
export type LktWorkspace = typeof lktWorkspaces.$inferSelect;
