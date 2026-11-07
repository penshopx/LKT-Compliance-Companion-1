import { pgTable, text, integer, boolean, timestamp, date, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { lktOrganizations } from "./lkt-organizations";

export const lktReferenceDigests = pgTable("lkt_reference_digests", {
  organizationId: text("organization_id").primaryKey().references(() => lktOrganizations.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull().default(false),
  revision: integer("revision").notNull().default(0),
  recipient: text("recipient").notNull(),
  recipientLabel: text("recipient_label").notNull(),
  slackChannelId: text("slack_channel_id").notNull(),
  slackTeamId: text("slack_team_id").notNull(),
  connectionId: text("connection_id").notNull(),
  cadence: text("cadence").$type<"daily" | "weekly">().notNull(),
  topic: text("topic").$type<"all" | "tax" | "capital_market" | "accounting_standards">().notNull().default("all"),
  timeWib: text("time_wib").notNull(),
  weekday: integer("weekday").notNull(),
  authorizedBy: text("authorized_by").notNull(),
  activatedAt: timestamp("activated_at", { withTimezone: true }).notNull().defaultNow(),
  pauseReason: text("pause_reason"),
});
export const insertLktReferenceDigestSchema = createInsertSchema(lktReferenceDigests);
export type LktReferenceDigest = typeof lktReferenceDigests.$inferSelect;

export const lktDigestDeliveries = pgTable("lkt_digest_deliveries", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => lktOrganizations.id, { onDelete: "cascade" }),
  day: date("day", { mode: "string" }).notNull(),
  revision: integer("revision").notNull(),
  status: text("status").$type<"sending" | "delivered" | "retry" | "failed" | "uncertain" | "cancelled" | "empty">().notNull(),
  attempts: integer("attempts").notNull().default(0),
  detail: text("detail"),
  messageText: text("message_text").notNull(),
  retryAt: timestamp("retry_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("lkt_digest_org_day").on(t.organizationId, t.day)]);
export const insertLktDigestDeliverySchema = createInsertSchema(lktDigestDeliveries);
export type LktDigestDelivery = typeof lktDigestDeliveries.$inferSelect;
