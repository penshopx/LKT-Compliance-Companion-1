import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { lktWorkspaces } from "./lkt-workspaces";

export const lktActivities = pgTable("lkt_activities", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => lktWorkspaces.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
export const insertLktActivitySchema = createInsertSchema(lktActivities);
export type LktActivity = typeof lktActivities.$inferSelect;
