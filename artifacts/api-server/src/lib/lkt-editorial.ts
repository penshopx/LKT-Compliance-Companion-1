import { asc, eq, inArray, sql } from "drizzle-orm";
import { db, lktEditors, lktEditorialEvents } from "@workspace/db";
import { AppendEditorialEventResponse, type EditorialEventInput, type Reference, type ReferenceReviewEvent } from "@workspace/api-zod";
import { references } from "./lkt-content";
import { editorialDay, withReviewReminder } from "./lkt-reference-review";
import { LktAccessError } from "./lkt-ai-limits";

const EventSchema = AppendEditorialEventResponse.shape.reviewHistory.element;

export function projectEditorialEvents(reference: Reference, events: ReferenceReviewEvent[], now = new Date()): Reference {
  let result = { ...reference, reviewHistory: [...reference.reviewHistory] };
  for (const event of events) {
    result = {
      ...result,
      editorialOwner: event.editorialOwner,
      assigneeUserId: event.assigneeUserId,
      nextReviewAt: event.nextReviewAt,
      // A scheduling action must never pretend the source was reviewed again.
      ...(event.kind === "schedule" ? {} : {
        reviewedAt: event.recordedAt,
        verificationStatus: event.verificationStatus,
        verified: event.verificationStatus === "verified_primary",
        verificationNotes: event.verificationNotes,
        applicability: event.applicability,
        effectivePeriod: event.effectivePeriod,
        standards: event.standards,
        primarySources: event.primarySources,
      }),
      reviewHistory: [...result.reviewHistory, event],
    };
  }
  return withReviewReminder(result, now);
}

export async function getEditorialReferences(database: Pick<typeof db, "select"> = db): Promise<Reference[]> {
  const rows = await database.select().from(lktEditorialEvents).orderBy(asc(lktEditorialEvents.id));
  return references.map(reference => projectEditorialEvents(reference,
    rows.filter(row => row.referenceId === reference.id).map(row => EventSchema.parse(row.snapshot))));
}

export function validCalendarDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "1900-01-01") return false;
  const day = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(day.getTime()) && day.toISOString().slice(0, 10) === value;
}

export function validateEditorialInput(input: EditorialEventInput, reference: Reference, day: string): void {
  if (!validCalendarDay(input.nextReviewAt) || input.nextReviewAt < day || !input.changeSummary.trim()) {
    throw new LktAccessError(400, "Isi alasan perubahan dan tanggal kalender WIB yang valid, hari ini atau setelahnya.");
  }
  if (input.kind === "schedule") {
    if (input.findings) throw new LktAccessError(400, "Perubahan jadwal tidak boleh mengubah temuan.");
    return;
  }
  const findings = input.findings;
  if (!findings || !findings.verificationNotes.trim() || !findings.applicability.trim() || !findings.effectivePeriod.trim()
    || findings.standards.some(item => !item.trim())) {
    throw new LktAccessError(400, "Snapshot harus memuat temuan lengkap, cakupan, periode dan batas verifikasi.");
  }
  for (const evidence of findings.primarySources) {
    let safeUrl = false;
    try { const url = new URL(evidence.url); safeUrl = url.protocol === "https:" && !url.username && !url.password; } catch { /* reject */ }
    if (!safeUrl || [evidence.title, evidence.locator, evidence.finding].some(s => !s.trim() || s.length > 12000)) {
      throw new LktAccessError(400, "Bukti primer memerlukan judul, URL HTTPS, lokasi pasal/bagian dan temuan.");
    }
  }
  if (findings.verificationStatus === "verified_primary"
    && (reference.sourceType !== "primary" || !findings.primarySources.length)) {
    throw new LktAccessError(400, "Status primer terverifikasi hanya untuk sumber primer dengan bukti dan batas temuan.");
  }
}

export async function appendEditorialEvent(userId: string, referenceId: string, input: EditorialEventInput): Promise<Reference> {
  const baseline = references.find(reference => reference.id === referenceId);
  if (!baseline) throw new LktAccessError(404, "Referensi tidak ditemukan.");
  return db.transaction(async tx => {
    // Serialize concurrent appends across processes and guard against stale forms.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('lkt-editorial'), hashtext(${referenceId}))`);
    const users = await tx.select().from(lktEditors)
      .where(inArray(lktEditors.userId, [userId, input.assigneeUserId]))
      .orderBy(asc(lktEditors.userId)).for("share");
    const actor = users.find(user => user.userId === userId);
    const assignee = users.find(user => user.userId === input.assigneeUserId);
    if (!actor) throw new LktAccessError(403, "Akses redaksi diperlukan; peran perusahaan tidak memberi izin ini.");
    if (!assignee) throw new LktAccessError(400, "Pilih penanggung jawab manusia dari daftar redaksi aktif.");
    const rows = await tx.select().from(lktEditorialEvents).where(eq(lktEditorialEvents.referenceId, referenceId)).orderBy(asc(lktEditorialEvents.id));
    const current = projectEditorialEvents(baseline, rows.map(row => EventSchema.parse(row.snapshot)));
    if (input.expectedRevision !== current.reviewHistory.length) throw new LktAccessError(409, "Referensi telah berubah. Muat ulang dan periksa temuan terbaru sebelum menyimpan.");
    const now = new Date();
    const day = editorialDay(now);
    validateEditorialInput(input, current, day);
    const event: ReferenceReviewEvent = {
      ...(input.kind === "findings" ? input.findings! : {
        verificationStatus: current.verificationStatus, verificationNotes: current.verificationNotes,
        applicability: current.applicability, effectivePeriod: current.effectivePeriod,
        standards: current.standards, primarySources: current.primarySources,
      }),
      kind: input.kind, actorUserId: userId, actorName: actor.displayName,
      assigneeUserId: assignee.userId, editorialOwner: assignee.displayName,
      recordedAt: day, createdAt: now.toISOString(), nextReviewAt: input.nextReviewAt,
      changeSummary: input.changeSummary.trim(),
    };
    await tx.insert(lktEditorialEvents).values({ referenceId, snapshot: EventSchema.parse(event) });
    return projectEditorialEvents(current, [event], now);
  });
}
