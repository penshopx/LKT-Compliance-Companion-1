import { pgTable, text, timestamp, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { lktOrganizations } from "./lkt-organizations";

// No free-text payloads, names, emails, consultations, or request metadata.
// Deletion receipts deliberately have no remaining company identifier.
export const lktAccessAudit = pgTable("lkt_access_audit", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").references(() => lktOrganizations.id, { onDelete: "cascade" }),
  actorUserId: text("actor_user_id").notNull(),
  action: text("action", { enum: ["member_added", "member_removed", "organization_deleted"] }).notNull(),
  targetUserId: text("target_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull().default(sql`now() + interval '90 days'`),
}, table => [
  index("lkt_access_audit_org_idx").on(table.organizationId, table.createdAt),
  index("lkt_access_audit_actor_idx").on(table.actorUserId, table.createdAt),
  index("lkt_access_audit_expiry_idx").on(table.expiresAt),
  check("lkt_access_audit_shape", sql`(
    (${table.action} in ('member_added', 'member_removed') and ${table.organizationId} is not null and ${table.targetUserId} is not null)
    or (${table.action} = 'organization_deleted' and ${table.organizationId} is null and ${table.targetUserId} is null)
  )`),
]);
export const insertLktAccessAuditSchema = createInsertSchema(lktAccessAudit);
export type LktAccessAudit = typeof lktAccessAudit.$inferSelect;
