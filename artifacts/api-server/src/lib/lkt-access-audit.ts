import { randomUUID } from "node:crypto";
import { lte } from "drizzle-orm";
import { db, lktAccessAudit } from "@workspace/db";
import { logger } from "./logger";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function recordAccessAudit(tx: Tx, actorUserId: string, event:
  | { action: "member_added" | "member_removed"; organizationId: string; targetUserId: string }
  | { action: "organization_deleted" }) {
  await tx.insert(lktAccessAudit).values({
    id: randomUUID(), actorUserId, action: event.action,
    organizationId: event.action === "organization_deleted" ? null : event.organizationId,
    targetUserId: event.action === "organization_deleted" ? null : event.targetUserId,
  });
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
