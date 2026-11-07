import { asc, eq, inArray, sql } from "drizzle-orm";
import { db, lktEditors, lktEditorialDrafts, lktEditorialEvents } from "@workspace/db";
import { type EditorialEventInput, type EditorialDraftApproval, type EditorialDraft, AppendEditorialEventResponse } from "@workspace/api-zod";
import { references } from "./lkt-content";
import { projectEditorialEvents, validateEditorialInput } from "./lkt-editorial";
import { editorialDay } from "./lkt-reference-review";
import { LktAccessError } from "./lkt-ai-limits";

const Event = AppendEditorialEventResponse.shape.reviewHistory.element;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export function draftResponse(row: typeof lktEditorialDrafts.$inferSelect): EditorialDraft {
  return { ...row, snapshot: Event.parse(row.snapshot) };
}

async function currentReference(tx: Tx, referenceId: string) {
  const baseline = references.find(r => r.id === referenceId);
  if (!baseline) throw new LktAccessError(404, "Referensi tidak ditemukan.");
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('lkt-editorial'), hashtext(${referenceId}))`);
  const rows = await tx.select().from(lktEditorialEvents).where(eq(lktEditorialEvents.referenceId, referenceId)).orderBy(asc(lktEditorialEvents.id));
  return projectEditorialEvents(baseline, rows.map(row => Event.parse(row.snapshot)));
}

async function activeEditors(tx: Tx, ids: string[]) {
  // Same sorted share locks as schedule writes: revoke cannot pass an in-flight publication.
  const users = await tx.select().from(lktEditors).where(inArray(lktEditors.userId, ids)).orderBy(asc(lktEditors.userId)).for("share");
  if (ids.some(id => !users.some(user => user.userId === id))) throw new LktAccessError(403, "Penulis, penyetuju, dan penanggung jawab harus tetap menjadi editor aktif.");
  return users;
}

export async function saveEditorialDraft(userId: string, referenceId: string, input: EditorialEventInput, draftId?: number, expectedVersion?: number) {
  return db.transaction(async tx => {
    const current = await currentReference(tx, referenceId);
    const users = await activeEditors(tx, [userId, input.assigneeUserId]);
    if (current.reviewHistory.length !== input.expectedRevision) throw new LktAccessError(409, "Referensi berubah. Muat ulang lalu periksa kembali draf terhadap temuan terbit.");
    if (input.kind !== "findings") throw new LktAccessError(400, "Draf hanya untuk temuan lengkap.");
    const now = new Date();
    validateEditorialInput(input, current, editorialDay(now));
    const snapshot = Event.parse({
      ...input.findings, kind: "findings", actorUserId: userId,
      actorName: users.find(u => u.userId === userId)!.displayName,
      assigneeUserId: input.assigneeUserId, editorialOwner: users.find(u => u.userId === input.assigneeUserId)!.displayName,
      recordedAt: editorialDay(now), createdAt: now.toISOString(), nextReviewAt: input.nextReviewAt, changeSummary: input.changeSummary.trim(),
    });
    if (draftId !== undefined) {
      const [draft] = await tx.select().from(lktEditorialDrafts).where(eq(lktEditorialDrafts.id, draftId)).for("update");
      if (!draft || draft.referenceId !== referenceId) throw new LktAccessError(404, "Draf tidak ditemukan.");
      if (draft.authorUserId !== userId) throw new LktAccessError(403, "Hanya penulis yang dapat merevisi draf.");
      if (draft.status !== "draft" || draft.version !== expectedVersion) throw new LktAccessError(409, "Draf berubah atau sudah terbit. Muat ulang sebelum melanjutkan.");
      const [updated] = await tx.update(lktEditorialDrafts).set({ snapshot, baseRevision: input.expectedRevision, version: draft.version + 1 }).where(eq(lktEditorialDrafts.id, draftId)).returning();
      return draftResponse(updated);
    }
    const [draft] = await tx.insert(lktEditorialDrafts).values({ referenceId, authorUserId: userId, baseRevision: input.expectedRevision, snapshot }).returning();
    return draftResponse(draft);
  });
}

export async function approveEditorialDraft(userId: string, draftId: number, input: EditorialDraftApproval) {
  return db.transaction(async tx => {
    const [hint] = await tx.select().from(lktEditorialDrafts).where(eq(lktEditorialDrafts.id, draftId));
    if (!hint) throw new LktAccessError(404, "Draf tidak ditemukan.");
    const current = await currentReference(tx, hint.referenceId);
    // Acquire roster locks before draft locks, consistently with author saves.
    const [lockedHint] = await tx.select().from(lktEditorialDrafts).where(eq(lktEditorialDrafts.id, draftId));
    const candidate = Event.parse(lockedHint.snapshot);
    const users = await activeEditors(tx, [userId, hint.authorUserId, candidate.assigneeUserId!]);
    const [draft] = await tx.select().from(lktEditorialDrafts).where(eq(lktEditorialDrafts.id, draftId)).for("update");
    if (draft.authorUserId === userId) throw new LktAccessError(403, "Penulis tidak boleh menyetujui draf sendiri. Minta editor kedua.");
    if (draft.status !== "draft" || draft.version !== input.expectedVersion || draft.baseRevision !== current.reviewHistory.length || input.expectedRevision !== current.reviewHistory.length) {
      throw new LktAccessError(409, "Draf atau referensi berubah, atau draf sudah terbit. Muat ulang dan periksa kembali.");
    }
    const snapshot = Event.parse(draft.snapshot);
    validateEditorialInput({
      kind: "findings", expectedRevision: draft.baseRevision, assigneeUserId: snapshot.assigneeUserId!,
      nextReviewAt: snapshot.nextReviewAt, changeSummary: snapshot.changeSummary, findings: snapshot,
    }, current, editorialDay());
    const event = Event.parse({ ...snapshot, draftId: draft.id, draftVersion: draft.version,
      approvedByUserId: userId, approvedByName: users.find(u => u.userId === userId)!.displayName, approvedAt: new Date().toISOString() });
    await tx.insert(lktEditorialEvents).values({ referenceId: draft.referenceId, snapshot: event });
    await tx.update(lktEditorialDrafts).set({ status: "published" }).where(eq(lktEditorialDrafts.id, draftId));
    return projectEditorialEvents(current, [event]);
  });
}
