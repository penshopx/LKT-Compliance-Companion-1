import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { lktWorkspaces } from "./lkt-workspaces";

export const lktMessages = pgTable("lkt_messages", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => lktWorkspaces.id, { onDelete: "cascade" }),
  role: text("role").$type<"user" | "assistant">().notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
export const insertLktMessageSchema = createInsertSchema(lktMessages);
export type LktMessage = typeof lktMessages.$inferSelect;
