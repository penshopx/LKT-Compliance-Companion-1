import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { lktOrganizations } from "./lkt-organizations";

export const lktAiLeases = pgTable("lkt_ai_leases", {
  organizationId: text("organization_id").primaryKey().references(() => lktOrganizations.id, { onDelete: "cascade" }),
  requestId: text("request_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
export const insertLktAiLeaseSchema = createInsertSchema(lktAiLeases);
export type LktAiLease = typeof lktAiLeases.$inferSelect;
