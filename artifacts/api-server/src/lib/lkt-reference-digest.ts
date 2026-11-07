import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@workspace/db/schema";
import { db, pool, lktReferenceDigests, lktDigestDeliveries, lktMemberships, type LktReferenceDigest } from "@workspace/db";
import { GetReferenceDigestResponse, type Reference, type ReferenceDigestInput } from "@workspace/api-zod";
import { LktAccessError } from "./lkt-ai-limits";
import { editorialDay } from "./lkt-reference-review";
import { getEditorialReferences } from "./lkt-editorial";
import { resolveSlackDestination, sendSlackDigest, type SendOutcome, type SlackDestination } from "./lkt-digest-slack";
import { logger } from "./logger";

type DigestDb = NodePgDatabase<typeof schema>;

export async function withDigestLock<T>(organizationId: string, fn: (database: DigestDb) => Promise<T>): Promise<T> {
  // Session lock spans the committed delivery claim AND the external call.
  // Rolling back a transaction containing both would lose the claim after a crash.
  const connection = await pool.connect();
  let locked = false;
  try {
    const result = await connection.query("SELECT pg_try_advisory_lock(hashtext('lkt-digest'), hashtext($1)) AS locked", [organizationId]);
    locked = result.rows[0].locked;
    if (!locked) throw new LktAccessError(409, "Pengiriman atau perubahan jadwal sedang berjalan. Coba lagi sebentar.");
    // All protected queries, including reference projection and local transactions,
    // reuse this connection. Acquiring a second pool slot here could deadlock
    // when concurrent companies already occupy every connection.
    return await fn(drizzle(connection, { schema }));
  } finally {
    try {
      if (locked) await connection.query("SELECT pg_advisory_unlock(hashtext('lkt-digest'), hashtext($1))", [organizationId]);
      connection.release();
    } catch {
      connection.release(true);
    }
  }
}

async function isOwner(organizationId: string, userId: string, database: DigestDb): Promise<boolean> {
  const [row] = await database.select().from(lktMemberships).where(and(
    eq(lktMemberships.organizationId, organizationId), eq(lktMemberships.userId, userId), eq(lktMemberships.role, "owner"),
  ));
  return !!row;
}

export async function readReferenceDigest(organizationId: string, canManage: boolean) {
  const [config] = await db.select().from(lktReferenceDigests).where(eq(lktReferenceDigests.organizationId, organizationId));
  const deliveries = await db.select().from(lktDigestDeliveries)
    .where(eq(lktDigestDeliveries.organizationId, organizationId)).orderBy(desc(lktDigestDeliveries.day)).limit(20);
  return GetReferenceDigestResponse.parse({
    canManage,
    config: config ? {
      enabled: config.enabled, revision: config.revision, channel: "slack", recipient: config.recipient,
      recipientLabel: config.recipientLabel, cadence: config.cadence, timeWib: config.timeWib, topic: config.topic,
      weekday: config.weekday, timezone: "Asia/Jakarta", pauseReason: config.pauseReason,
    } : {
      enabled: false, revision: 0, channel: "slack", recipient: "", recipientLabel: "",
      cadence: "weekly", timeWib: "09:00", weekday: 1, topic: "all", timezone: "Asia/Jakarta", pauseReason: null,
    },
    deliveries: deliveries.map(row => ({
      id: row.id, day: row.day, status: row.status, attempts: row.attempts, detail: row.detail, updatedAt: row.updatedAt.toISOString(),
    })),
  });
}

async function cancelPending(organizationId: string, database: DigestDb) {
  await database.update(lktDigestDeliveries).set({
    status: "cancelled", retryAt: null, detail: "Dibatalkan karena jadwal diubah atau langganan dihentikan.", updatedAt: new Date(),
  }).where(and(eq(lktDigestDeliveries.organizationId, organizationId), eq(lktDigestDeliveries.status, "retry")));
}

export async function configureReferenceDigest(
  organizationId: string, userId: string, input: ReferenceDigestInput,
  resolve = resolveSlackDestination,
) {
  await withDigestLock(organizationId, async db => {
    if (!await isOwner(organizationId, userId, db)) throw new LktAccessError(403, "Hanya pemilik perusahaan dapat mengatur pengiriman tim.");
    const [current] = await db.select().from(lktReferenceDigests).where(eq(lktReferenceDigests.organizationId, organizationId));
    if ((current?.revision ?? 0) !== input.expectedRevision) throw new LktAccessError(409, "Pengaturan telah berubah. Muat ulang sebelum menyimpan.");
    const destination = await resolve(input.recipient);
    // Re-check after remote validation; access might have been revoked meanwhile.
    if (!await isOwner(organizationId, userId, db)) throw new LktAccessError(403, "Akses pemilik telah berubah.");
    await db.transaction(async tx => {
      const value = {
        organizationId, enabled: true, revision: input.expectedRevision + 1, recipient: input.recipient,
        ...destination, cadence: input.cadence, timeWib: input.timeWib, weekday: input.weekday, topic: input.topic,
        authorizedBy: userId, activatedAt: new Date(), pauseReason: null,
      };
      await tx.insert(lktReferenceDigests).values(value).onConflictDoUpdate({ target: lktReferenceDigests.organizationId, set: value });
      await tx.update(lktDigestDeliveries).set({
        status: "cancelled", retryAt: null, detail: "Jadwal berubah; percobaan ulang dibatalkan.", updatedAt: new Date(),
      }).where(and(eq(lktDigestDeliveries.organizationId, organizationId), eq(lktDigestDeliveries.status, "retry")));
    });
  });
  return readReferenceDigest(organizationId, true);
}

export async function stopReferenceDigest(organizationId: string, userId: string) {
  await withDigestLock(organizationId, async db => {
    if (!await isOwner(organizationId, userId, db)) throw new LktAccessError(403, "Hanya pemilik perusahaan dapat menghentikan pengiriman tim.");
    await db.update(lktReferenceDigests).set({
      enabled: false, revision: sql`${lktReferenceDigests.revision} + 1`, pauseReason: "Berhenti berlangganan oleh pemilik.",
    }).where(eq(lktReferenceDigests.organizationId, organizationId));
    await cancelPending(organizationId, db);
  });
  return readReferenceDigest(organizationId, true);
}

export function digestSlot(config: Pick<LktReferenceDigest, "cadence" | "timeWib" | "weekday" | "activatedAt">, now: Date): string | null {
  const day = editorialDay(now);
  const slot = new Date(`${day}T${config.timeWib}:00+07:00`);
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  if (config.cadence === "weekly" && weekday !== config.weekday) return null;
  // Activation never sends immediately or replays an earlier slot.
  if (slot.getTime() <= config.activatedAt.getTime() || now < slot) return null;
  return day;
}

const statusLabels: Record<Reference["verificationStatus"], string> = {
  verified_primary: "Primer terverifikasi (terbatas)", reviewed_secondary: "Sekunder ditinjau",
  needs_review: "Perlu ditinjau", outdated: "Usang",
  unavailable: "Belum dapat diperiksa",
};
const topicLabels: Record<ReferenceDigestInput["topic"], string> = {
  all: "Seluruh pustaka", tax: "Perpajakan", capital_market: "Pasar modal", accounting_standards: "Standar akuntansi",
};

function matchesTopic(ref: Reference, topic: ReferenceDigestInput["topic"]): boolean {
  switch (topic) {
    case "all": return true;
    case "tax": return ref.reportType === "tax_return";
    case "capital_market": return ref.scope === "publik";
    // A nonempty standards array alone is insufficient: it can describe tax
    // rules or market regulation rather than an accounting standard.
    case "accounting_standards": return ref.standards.some(standard => /^SAK(?:\s|$)/i.test(standard.trim()));
    default: throw new Error("Unsupported reference digest topic");
  }
}

export function buildDigestText(refs: Reference[], day: string, topic: ReferenceDigestInput["topic"] = "all"): string | null {
  const due = refs.filter(ref => matchesTopic(ref, topic)
    && (ref.nextReviewAt <= day || ["needs_review", "outdated"].includes(ref.verificationStatus)))
    .sort((a, b) => a.nextReviewAt.localeCompare(b.nextReviewAt) || a.id.localeCompare(b.id));
  if (!due.length) return null;
  const clean = (text: string, length: number) => text.replace(/[<>&\r\n]/g, " ").slice(0, length);
  return [
    `LKTara — ringkasan referensi ${day} (WIB)`,
    `Cakupan: ${topicLabels[topic]}.`,
    `${due.length} referensi perlu perhatian. Ini pengingat editorial, bukan tenggat hukum atau jaminan kepatuhan.`,
    ...due.slice(0, 20).map(ref => [
      `• ${clean(ref.title, 180)}`,
      `Status: ${statusLabels[ref.verificationStatus]}. Ditinjau: ${ref.reviewedAt}. Jadwal tinjau: ${ref.nextReviewAt}${ref.nextReviewAt < day ? " (lewat jadwal)" : ref.nextReviewAt === day ? " (hari ini)" : ""}.`,
      `Penanggung jawab: ${clean(ref.editorialOwner, 100)}. Batas temuan: ${clean(ref.verificationNotes, 260)}…`,
    ].join("\n")),
    ...(due.length > 20 ? [`${due.length - 20} referensi lainnya tersedia di pustaka.`] : []),
    "Lihat temuan lengkap, cakupan, periode, dan bukti di LKTara > Referensi sebelum menggunakannya.",
    "Pengiriman tidak mengubah status verifikasi atau jadwal tinjau. Berhenti berlangganan: pemilik tim membuka Referensi > Ringkasan terjadwal > Berhenti berlangganan.",
  ].join("\n\n");
}

type DigestDependencies = {
  references: (database: DigestDb) => Promise<Reference[]>;
  send: (destination: SlackDestination, text: string, id: string) => Promise<SendOutcome>;
};
const defaults: DigestDependencies = { references: getEditorialReferences, send: sendSlackDigest };

export async function processReferenceDigest(organizationId: string, now = new Date(), deps = defaults) {
  await withDigestLock(organizationId, async db => {
    const [config] = await db.select().from(lktReferenceDigests).where(eq(lktReferenceDigests.organizationId, organizationId));
    if (!config?.enabled) return;
    if (!await isOwner(organizationId, config.authorizedBy, db)) {
      await db.update(lktReferenceDigests).set({ enabled: false, pauseReason: "Pemilik yang menyetujui jadwal tidak lagi berwenang.", revision: config.revision + 1 })
        .where(eq(lktReferenceDigests.organizationId, organizationId));
      await cancelPending(organizationId, db);
      return;
    }
    // A leftover claim means a process died after committing it. Never replay it.
    const interrupted = await db.update(lktDigestDeliveries).set({
      status: "uncertain", detail: "Proses terhenti saat mengirim; periksa Slack. Tidak dicoba ulang.", updatedAt: now,
    }).where(and(eq(lktDigestDeliveries.organizationId, organizationId), eq(lktDigestDeliveries.status, "sending"))).returning();
    if (interrupted.length) {
      await db.update(lktReferenceDigests).set({
        enabled: false, revision: config.revision + 1, pauseReason: "Proses pengiriman terhenti. Periksa Slack sebelum mengaktifkan kembali.",
      }).where(eq(lktReferenceDigests.organizationId, organizationId));
      await cancelPending(organizationId, db);
      return;
    }
    await db.update(lktDigestDeliveries).set({
      status: "cancelled", retryAt: null, detail: "Periode WIB telah lewat; tidak ada pengiriman susulan.", updatedAt: now,
    }).where(and(eq(lktDigestDeliveries.organizationId, organizationId), eq(lktDigestDeliveries.status, "retry"),
      sql`${lktDigestDeliveries.day} < ${editorialDay(now)}::date`));
    const day = digestSlot(config, now);
    if (!day) return;
    let [delivery] = await db.select().from(lktDigestDeliveries).where(and(
      eq(lktDigestDeliveries.organizationId, organizationId), eq(lktDigestDeliveries.day, day),
    ));
    if (delivery) {
      if (delivery.status !== "retry" || delivery.revision !== config.revision || !delivery.retryAt || delivery.retryAt > now) return;
    } else {
      const text = buildDigestText(await deps.references(db), day, config.topic);
      const rows = await db.insert(lktDigestDeliveries).values({
        id: randomUUID(), organizationId, day, revision: config.revision, status: text ? "sending" : "empty",
        messageText: text ?? "", attempts: 0, detail: text ? null : "Tidak ada referensi perlu perhatian dalam topik yang dipilih.", updatedAt: now,
      }).onConflictDoNothing().returning();
      if (!rows.length || !text) return;
      delivery = rows[0];
    }
    const attempts = delivery.attempts + 1;
    // Commit the claim BEFORE contacting Slack, even on retries.
    await db.update(lktDigestDeliveries).set({ status: "sending", attempts, retryAt: null, updatedAt: now })
      .where(eq(lktDigestDeliveries.id, delivery.id));
    const outcome = await deps.send(config, delivery.messageText, delivery.id);
    const status = outcome.status === "retry" && attempts >= 3 ? "failed" : outcome.status;
    const retryAt = outcome.status === "retry" && status === "retry"
      ? new Date(now.getTime() + Math.min(86400, Math.max(60, outcome.retrySeconds ?? 60)) * 1000) : null;
    await db.update(lktDigestDeliveries).set({
      status, detail: status === "failed" && outcome.status === "retry" ? "Tiga percobaan ditolak batas Slack; jadwal dijeda." : outcome.detail,
      retryAt, updatedAt: new Date(),
    }).where(eq(lktDigestDeliveries.id, delivery.id));
    if (status === "failed" || status === "uncertain") {
      await db.update(lktReferenceDigests).set({
        enabled: false, revision: config.revision + 1, pauseReason: "Pengiriman gagal atau belum pasti. Periksa riwayat dan Slack sebelum mengaktifkan kembali.",
      }).where(eq(lktReferenceDigests.organizationId, organizationId));
    }
  });
}

export async function runReferenceDigestTick(now = new Date(), deps = defaults) {
  const configs = await db.select({ id: lktReferenceDigests.organizationId }).from(lktReferenceDigests).where(eq(lktReferenceDigests.enabled, true));
  for (const config of configs) {
    try { await processReferenceDigest(config.id, now, deps); }
    catch (error) {
      if (!(error instanceof LktAccessError && error.status === 409)) logger.error("Reference digest processing failed; durable claim retained.");
    }
  }
}

export function startReferenceDigestScheduler() {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runReferenceDigestTick();
    } catch {
      logger.error("Reference digest scheduler unavailable; no unconfigured messages sent.");
    } finally { running = false; }
  };
  void tick();
  const timer = setInterval(() => { void tick(); }, 60_000);
  timer.unref();
  return () => clearInterval(timer);
}
