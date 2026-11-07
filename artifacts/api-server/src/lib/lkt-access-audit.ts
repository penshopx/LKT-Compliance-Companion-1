import { randomUUID } from "node:crypto";
import { eq, lte } from "drizzle-orm";
import { db, lktAccessAudit, lktAccessNotifications, lktAccessDeliveries } from "@workspace/db";
import { logger } from "./logger";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// The account page displays WIB, so both inclusive date filters use WIB too.
export function auditDayStart(day: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day.startsWith("0000-")) return undefined;
  const utc = new Date(`${day}T00:00:00.000Z`);
  if (!Number.isFinite(utc.getTime()) || utc.toISOString().slice(0, 10) !== day) return undefined;
  return new Date(utc.getTime() - 7 * 3600000);
}

export async function recordAccessAudit(tx: Tx, actorUserId: string, event:
  | { action: "member_added" | "member_removed"; organizationId: string; targetUserId: string }
  | { action: "organization_deleted" }) {
  const id = randomUUID();
  await tx.insert(lktAccessAudit).values({
    id, actorUserId, action: event.action,
    organizationId: event.action === "organization_deleted" ? null : event.organizationId,
    targetUserId: event.action === "organization_deleted" ? null : event.targetUserId,
  });
  if (event.action !== "organization_deleted") {
    const [config] = await tx.select().from(lktAccessNotifications).where(eq(lktAccessNotifications.organizationId, event.organizationId));
    if (config?.enabled) await tx.insert(lktAccessDeliveries).values({
      id, organizationId: event.organizationId, revision: config.revision, status: "pending",
    }).onConflictDoNothing();
  }
}

export async function purgeExpiredAccessAudit() {
  await db.delete(lktAccessAudit).where(lte(lktAccessAudit.expiresAt, new Date()));
}

// Startup + hourly cleanup, including quiet accounts and deleted companies.
// Reads also exclude expired records immediately; downtime is caught up at startup.
export function startAccessAuditRetention() {
  const purge = () => purgeExpiredAccessAudit().catch(() => {
    logger.error("Access audit retention cleanup failed; retrying in one hour");
  });
  void purge();
  const timer = setInterval(() => void purge(), 60 * 60 * 1000);
  timer.unref();
}

export const accessAuditFields = {
  id: lktAccessAudit.id, actorUserId: lktAccessAudit.actorUserId,
  action: lktAccessAudit.action, targetUserId: lktAccessAudit.targetUserId,
  createdAt: lktAccessAudit.createdAt, expiresAt: lktAccessAudit.expiresAt,
};
