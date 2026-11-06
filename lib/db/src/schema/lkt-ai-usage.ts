import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// One durable counter per account/company. No prompt content is stored here.
export const lktAiUsage = pgTable("lkt_ai_usage", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
});
export const insertLktAiUsageSchema = createInsertSchema(lktAiUsage);
export type LktAiUsage = typeof lktAiUsage.$inferSelect;
