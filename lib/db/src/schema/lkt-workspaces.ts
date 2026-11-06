import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const lktWorkspaces = pgTable("lkt_workspaces", {
  id: text("id").primaryKey(),
  profile: jsonb("profile").$type<{ name: string; kind: string; year: number; standard: string }>().notNull(),
  tasks: jsonb("tasks").$type<Record<string, {status: string; notes: string}>>().notNull().default({}),
  bookmarks: jsonb("bookmarks").$type<Record<string, boolean>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
export const insertLktWorkspaceSchema = createInsertSchema(lktWorkspaces);
export type LktWorkspace = typeof lktWorkspaces.$inferSelect;
