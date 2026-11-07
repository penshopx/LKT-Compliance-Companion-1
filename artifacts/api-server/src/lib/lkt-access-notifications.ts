import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@workspace/db/schema";
import { db, pool, lktAccessNotifications, lktAccessDeliveries, lktAccessAudit, lktOrganizations } from "@workspace/db";
import { GetAccessNotificationsResponse, type AccessNotificationInput } from "@workspace/api-zod";
import { assertMembership, lockOrganization, LktAccessError } from "./lkt-ai-limits";
import { resolveSlackDestination, sendSlackDigest } from "./lkt-digest-slack";
import { logger } from "./logger";

type Database = NodePgDatabase<typeof schema>;
// This session lock spans the durable claim and send, but NOT one long DB
// transaction. Settings and company deletion must use the same lock.
export async function withAccessNotificationLock<T>(organizationId: string, fn: (database: Database) => Promise<T>): Promise<T> {
  const connection = await pool.connect();
  let locked = false;
  try {
    const result = await connection.query("SELECT pg_try_advisory_lock(hashtext('lkt-access-notify'), hashtext($1)) AS locked", [organizationId]);
    locked = result.rows[0].locked;
    if (!locked) throw new LktAccessError(409, "Pengiriman atau perubahan notifikasi sedang berjalan. Coba lagi sebentar.");
    return await fn(drizzle(connection, { schema }));
  } finally {
    try {
      if (locked) await connection.query("SELECT pg_advisory_unlock(hashtext('lkt-access-notify'), hashtext($1))", [organizationId]);
      connection.release();
    } catch { connection.release(true); }
  }
}

export async function readAccessNotifications(organizationId: string, userId: string, database: Database = db) {
  // Re-check membership inside the same company lock as deletion/revocation.
  return database.transaction(async tx => {
    await lockOrganization(tx, organizationId);
    await assertMembership(tx, organizationId, userId, true);
    const [config] = await tx.select().from(lktAccessNotifications).where(eq(lktAccessNotifications.organizationId, organizationId));
    const deliveries = await tx.select({
      id: lktAccessDeliveries.id, status: lktAccessDeliveries.status, updatedAt: lktAccessDeliveries.updatedAt,
    }).from(lktAccessDeliveries).where(eq(lktAccessDeliveries.organizationId, organizationId))
      .orderBy(desc(lktAccessDeliveries.updatedAt), desc(lktAccessDeliveries.id)).limit(10);
    return GetAccessNotificationsResponse.parse({
      enabled: config?.enabled ?? false, revision: config?.revision ?? 0,
      recipient: config?.recipient ?? "", recipientLabel: config?.recipientLabel ?? "",
      deliveries: deliveries.map(row => ({ ...row, updatedAt: row.updatedAt.toISOString() })),
    });
  });
}

export async function configureAccessNotifications(
  organizationId: string, userId: string, input: AccessNotificationInput, resolve = resolveSlackDestination,
) {
  return withAccessNotificationLock(organizationId, async database => {
    await readAccessNotifications(organizationId, userId, database);
    const destination = await resolve(input.recipient);
    await database.transaction(async tx => {
      await lockOrganization(tx, organizationId);
      await assertMembership(tx, organizationId, userId, true);
      const [current] = await tx.select().from(lktAccessNotifications).where(eq(lktAccessNotifications.organizationId, organizationId));
      if ((current?.revision ?? 0) !== input.expectedRevision) throw new LktAccessError(409, "Pengaturan berubah. Muat ulang sebelum menyimpan.");
      const value = {
        organizationId, authorizedBy: userId, enabled: true, revision: input.expectedRevision + 1,
        recipient: input.recipient, ...destination,
      };
      await tx.insert(lktAccessNotifications).values(value).onConflictDoUpdate({ target: lktAccessNotifications.organizationId, set: value });
      await tx.update(lktAccessDeliveries).set({ status: "cancelled", updatedAt: new Date() }).where(and(
        eq(lktAccessDeliveries.organizationId, organizationId), eq(lktAccessDeliveries.status, "pending"),
      ));
    });
    return readAccessNotifications(organizationId, userId, database);
  });
}

export async function stopAccessNotifications(organizationId: string, userId: string) {
  return withAccessNotificationLock(organizationId, async database => {
    await database.transaction(async tx => {
      await lockOrganization(tx, organizationId);
      await assertMembership(tx, organizationId, userId, true);
      const [current] = await tx.select().from(lktAccessNotifications).where(eq(lktAccessNotifications.organizationId, organizationId));
      if (current) await tx.update(lktAccessNotifications).set({ enabled: false, revision: current.revision + 1 })
        .where(eq(lktAccessNotifications.organizationId, organizationId));
      await tx.update(lktAccessDeliveries).set({ status: "cancelled", updatedAt: new Date() }).where(and(
        eq(lktAccessDeliveries.organizationId, organizationId), eq(lktAccessDeliveries.status, "pending"),
      ));
    });
    return readAccessNotifications(organizationId, userId, database);
  });
}

export function accessNotificationText(company: string, action: string, at: Date) {
  const name = company.replace(/[<>&\r\n]/g, " ").slice(0, 120);
  return `LKTara — perubahan akses tim\nPerusahaan: ${name}\n${action === "member_added" ? "Akses anggota diberikan" : "Akses anggota dicabut"}\nWaktu: ${at.toISOString()}\nRincian hanya tersedia bagi pemilik di Tim & akun > Jejak audit akses.`;
}

export async function processAccessNotifications(organizationId: string, send = sendSlackDigest) {
  await withAccessNotificationLock(organizationId, async database => {
    // A crash after claiming may already have posted. Never replay that claim.
    await database.update(lktAccessDeliveries).set({ status: "uncertain", updatedAt: new Date() }).where(and(
      eq(lktAccessDeliveries.organizationId, organizationId), eq(lktAccessDeliveries.status, "sending"),
    ));
    const [config] = await database.select().from(lktAccessNotifications).where(eq(lktAccessNotifications.organizationId, organizationId));
    if (!config?.enabled) return;
    const claimed = await database.transaction(async tx => {
      await lockOrganization(tx, organizationId);
      await assertMembership(tx, organizationId, config.authorizedBy, true);
      const [organization] = await tx.select().from(lktOrganizations).where(eq(lktOrganizations.id, organizationId));
      const [delivery] = await tx.select({
        id: lktAccessDeliveries.id, action: lktAccessAudit.action, at: lktAccessAudit.createdAt,
      }).from(lktAccessDeliveries).innerJoin(lktAccessAudit, eq(lktAccessAudit.id, lktAccessDeliveries.id)).where(and(
        eq(lktAccessDeliveries.organizationId, organizationId), eq(lktAccessDeliveries.status, "pending"),
        eq(lktAccessDeliveries.revision, config.revision), gt(lktAccessAudit.expiresAt, new Date()),
      )).orderBy(lktAccessAudit.createdAt, lktAccessDeliveries.id).limit(1);
      if (!delivery || !organization) return null;
      await tx.update(lktAccessDeliveries).set({ status: "sending", updatedAt: new Date() }).where(eq(lktAccessDeliveries.id, delivery.id));
      return { ...delivery, name: organization.name };
    });
    if (!claimed) return;
    let status: "delivered" | "failed" | "uncertain";
    try {
      const outcome = await send(config, accessNotificationText(claimed.name, claimed.action, claimed.at), claimed.id);
      // Even a known rate-limit rejection is terminal here. No automatic external
      // retries: favor no duplicates, and expose failure for owner inspection.
      status = outcome.status === "retry" ? "failed" : outcome.status;
    } catch { status = "uncertain"; }
    await database.update(lktAccessDeliveries).set({ status, updatedAt: new Date() }).where(eq(lktAccessDeliveries.id, claimed.id));
  });
}

export function startAccessNotificationWorker() {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const organizations = await db.selectDistinct({ id: lktAccessDeliveries.organizationId }).from(lktAccessDeliveries)
        .where(inArray(lktAccessDeliveries.status, ["pending", "sending"]));
      for (const organization of organizations) {
        try { await processAccessNotifications(organization.id); }
        catch (error) {
          if (!(error instanceof LktAccessError && error.status === 409)) logger.error("Access notification processing failed; durable claim retained.");
        }
      }
    } catch { logger.error("Access notification queue unavailable; no unconfigured messages sent."); }
    finally { running = false; }
  };
  void tick();
  const timer = setInterval(() => void tick(), 10_000);
  timer.unref();
  return () => clearInterval(timer);
}
