import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const lktOrganizations = pgTable("lkt_organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const insertLktOrganizationSchema = createInsertSchema(lktOrganizations);
export type LktOrganization = typeof lktOrganizations.$inferSelect;
