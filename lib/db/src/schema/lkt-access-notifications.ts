import { boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { lktOrganizations } from "./lkt-organizations";
import { lktAccessAudit } from "./lkt-access-audit";

export const lktAccessNotifications = pgTable("lkt_access_notifications", {
  organizationId: text("organization_id").primaryKey().references(() => lktOrganizations.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull().default(false),
  revision: integer("revision").notNull().default(0),
  authorizedBy: text("authorized_by").notNull(),
  recipient: text("recipient").notNull(),
  recipientLabel: text("recipient_label").notNull(),
  slackChannelId: text("slack_channel_id").notNull(),
  slackTeamId: text("slack_team_id").notNull(),
  connectionId: text("connection_id").notNull(),
});
export const insertLktAccessNotificationSchema = createInsertSchema(lktAccessNotifications);
export type LktAccessNotification = typeof lktAccessNotifications.$inferSelect;

// No message body, member identity or company name is copied into the outbox.
export const lktAccessDeliveries = pgTable("lkt_access_deliveries", {
  id: text("id").primaryKey().references(() => lktAccessAudit.id, { onDelete: "cascade" }),
  organizationId: text("organization_id").notNull().references(() => lktOrganizations.id, { onDelete: "cascade" }),
  revision: integer("revision").notNull(),
  status: text("status").$type<"pending" | "sending" | "delivered" | "failed" | "uncertain" | "cancelled">().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export const insertLktAccessDeliverySchema = createInsertSchema(lktAccessDeliveries);
export type LktAccessDelivery = typeof lktAccessDeliveries.$inferSelect;
