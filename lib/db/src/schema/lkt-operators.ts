import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// No company role or first-account bootstrap can confer this authority.
export const lktOperators = pgTable("lkt_operators", {
  userId: text("user_id").primaryKey(),
  displayName: text("display_name").notNull(),
});
// Deliberately no FK to live grants: removal must retain attribution.
export const lktEditorialAccessEvents = pgTable("lkt_editorial_access_events", {
  id: serial("id").primaryKey(),
  actorId: text("actor_id").notNull(),
  actorName: text("actor_name").notNull(),
  source: text("source").notNull(),
  role: text("role").notNull(),
  action: text("action").notNull(),
  targetUserId: text("target_user_id").notNull(),
  targetName: text("target_name").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const insertLktOperatorSchema = createInsertSchema(lktOperators);
export const insertLktEditorialAccessEventSchema = createInsertSchema(lktEditorialAccessEvents).omit({ id: true, createdAt: true });
