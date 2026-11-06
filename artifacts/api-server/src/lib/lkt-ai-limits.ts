import { randomUUID } from "node:crypto";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { db, lktOrganizations, lktMemberships, lktAiUsage, lktAiLeases } from "@workspace/db";

export class LktAccessError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Organization lock serializes deletion, lease reservation and history deletion
// across server replicas. Leases expire after worker crashes, quotas survive restarts.
export async function lockOrganization(tx: Tx, id: string) {
  const [org] = await tx.select().from(lktOrganizations).where(eq(lktOrganizations.id, id)).for("update");
  if (!org) throw new LktAccessError(403, "Perusahaan tidak tersedia.");
}
export async function assertNoConsultation(tx: Tx, organizationId: string) {
  const [lease] = await tx.select().from(lktAiLeases).where(and(
    eq(lktAiLeases.organizationId, organizationId), gt(lktAiLeases.expiresAt, new Date()),
  ));
  if (lease) throw new LktAccessError(409, "Tunggu konsultasi selesai sebelum menghapus data.");
}
export async function assertMembership(tx: Tx, organizationId: string, userId: string, owner = false) {
  const [membership] = await tx.select().from(lktMemberships).where(and(
    eq(lktMemberships.organizationId, organizationId), eq(lktMemberships.userId, userId),
  ));
  if (!membership || (owner && membership.role !== "owner")) {
    throw new LktAccessError(403, "Akses perusahaan telah dicabut atau tidak diizinkan.");
  }
}
export async function reserveConsultation(organizationId: string, userId: string): Promise<string> {
  const requestId = randomUUID();
  // Opportunistic retention cleanup; counters contain no company content.
  await db.delete(lktAiUsage).where(lt(lktAiUsage.resetAt, new Date()));
  await db.transaction(async tx => {
    await lockOrganization(tx, organizationId);
    await assertMembership(tx, organizationId, userId);
    await assertNoConsultation(tx, organizationId);
    for (const [key, limit] of [[`account:${userId}`, 12], [`organization:${organizationId}`, 36]] as const) {
      const [counter] = await tx.insert(lktAiUsage).values({
        key, count: 1, resetAt: new Date(Date.now() + 3600000),
      }).onConflictDoUpdate({
        target: lktAiUsage.key,
        set: {
          count: sql`case when ${lktAiUsage.resetAt} <= now() then 1 else ${lktAiUsage.count} + 1 end`,
          resetAt: sql`case when ${lktAiUsage.resetAt} <= now() then now() + interval '1 hour' else ${lktAiUsage.resetAt} end`,
        },
        setWhere: sql`${lktAiUsage.resetAt} <= now() or ${lktAiUsage.count} < ${limit}`,
      }).returning();
      if (!counter) throw new LktAccessError(429, `Batas konsultasi tercapai: 12 percobaan per jam per akun dan 36 per perusahaan. Coba lagi nanti.`);
    }
    await tx.insert(lktAiLeases).values({
      organizationId, requestId, expiresAt: new Date(Date.now() + 180000),
    }).onConflictDoUpdate({
      target: lktAiLeases.organizationId,
      set: { requestId, expiresAt: new Date(Date.now() + 180000) },
    });
  });
  return requestId;
}
export async function releaseConsultation(organizationId: string, requestId: string) {
  await db.delete(lktAiLeases).where(and(eq(lktAiLeases.organizationId, organizationId), eq(lktAiLeases.requestId, requestId)));
}
