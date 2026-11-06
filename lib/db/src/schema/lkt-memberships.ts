import { pgTable, text, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { lktOrganizations } from "./lkt-organizations";

export const lktMemberships = pgTable("lkt_memberships", {
  organizationId: text("organization_id").notNull().references(() => lktOrganizations.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  role: text("role").$type<"owner" | "member">().notNull(),
}, t => [primaryKey({ columns: [t.organizationId, t.userId] })]);
export const insertLktMembershipSchema = createInsertSchema(lktMemberships);
export type LktMembership = typeof lktMemberships.$inferSelect;
