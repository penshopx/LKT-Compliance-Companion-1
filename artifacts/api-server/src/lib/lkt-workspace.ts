import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, lktActivities, lktMessages, lktWorkspaces, type LktWorkspace } from "@workspace/db";
import { checklist } from "./lkt-content";
import { getEditorialReferences } from "./lkt-editorial";
import { createReferenceSnapshot, referenceFreshness } from "./lkt-consultation-snapshot";

export const defaultProfile = { name: "Perusahaan Anda", kind: "nonpublik", year: 2026, standard: "Belum ditentukan" };
export function getTasks(w: LktWorkspace) {
  return checklist.filter(t => t.scope === "umum" || t.scope === w.profile.kind)
    .map(t => ({ ...t, status: w.tasks[`${w.profile.year}:${t.id}`]?.status ?? "belum", notes: w.tasks[`${w.profile.year}:${t.id}`]?.notes ?? "" }));
}
export async function activity(id: string, title: string) {
  await db.insert(lktActivities).values({ id: randomUUID(), workspaceId: id, title });
}
export class InvalidMessageCursor extends Error {}

export async function messagePage(id: string, { before, limit = 80, q }: { before?: string; limit?: number; q?: string } = {}) {
  const query = q?.trim() ?? "";
  let anchorId: string | undefined;
  if (before !== undefined) {
    let cursor: { v: number; workspace: string; id: string; query?: string };
    try {
      cursor = JSON.parse(Buffer.from(before, "base64url").toString("utf8"));
      if (cursor.v !== 1 || cursor.workspace !== id || typeof cursor.id !== "string"
        || (cursor.query ?? "") !== query) throw new Error();
    } catch {
      throw new InvalidMessageCursor("Cursor riwayat tidak valid atau sudah dihapus. Muat ulang riwayat.");
    }
    const [anchor] = await db.select({ id: lktMessages.id }).from(lktMessages)
      .where(and(eq(lktMessages.workspaceId, id), eq(lktMessages.id, cursor.id)));
    if (!anchor) throw new InvalidMessageCursor("Cursor riwayat tidak valid atau sudah dihapus. Muat ulang riwayat.");
    anchorId = anchor.id;
  }
  // Compare timestamps inside PostgreSQL: JS Date would truncate microseconds,
  // potentially skipping rows at a page boundary.
  const older = anchorId === undefined ? undefined : sql`(${lktMessages.createdAt}, ${lktMessages.id}) < (
    SELECT created_at, id FROM lkt_messages WHERE workspace_id = ${id} AND id = ${anchorId}
  )`;
  // Escape LIKE metacharacters: user input is literal text, not a pattern.
  const matches = query ? sql`${lktMessages.content} ILIKE ${`%${query.replace(/[\\%_]/g, "\\$&")}%`}` : undefined;
  const prior = alias(lktMessages, "prior");
  // Resolve the immediate predecessor in the full company history, even when
  // it does not match the search. Never pair with a distant matching question.
  const predecessor = db.select().from(prior)
    .where(and(eq(prior.workspaceId, id),
      sql`(${prior.createdAt}, ${prior.id}) < (${lktMessages.createdAt}, ${lktMessages.id})`))
    .orderBy(desc(prior.createdAt), desc(prior.id)).limit(1).as("predecessor");
  const rows = await db.select({
    message: lktMessages,
    previous: { id: predecessor.id, role: predecessor.role, content: predecessor.content, createdAt: predecessor.createdAt },
  }).from(lktMessages)
    .leftJoinLateral(predecessor, sql`true`)
    .where(and(eq(lktMessages.workspaceId, id), older, matches))
    .orderBy(desc(lktMessages.createdAt), desc(lktMessages.id)).limit(limit + 1);
  const hasOlder = rows.length > limit;
  const page = rows.slice(0, limit);
  const oldest = page.at(-1)?.message;
  const currentVersion = createReferenceSnapshot(await getEditorialReferences()).knowledgeVersion;
  return {
    nextCursor: hasOlder && oldest ? Buffer.from(JSON.stringify({ v: 1, workspace: id, id: oldest.id, query })).toString("base64url") : null,
    messages: page.map(({ message: m, previous }) => {
      const originalQuestion = m.role === "assistant" && previous?.role === "user"
        && previous.createdAt.getTime() < m.createdAt.getTime()
        && previous.content.trim()
        ? { id: previous.id, content: previous.content } : null;
      return {
        id: m.id, role: m.role, content: m.content, createdAt: m.createdAt.toISOString(), specialist: m.specialist,
        referenceSnapshot: m.referenceSnapshot,
        referenceFreshness: referenceFreshness(m.role, m.referenceSnapshot, currentVersion),
        originalQuestion,
      };
    }).reverse(),
  };
}
export async function recentMessages(id: string) {
  return (await messagePage(id, { limit: 12 })).messages;
}
export async function saveTask(w: LktWorkspace, id: string, value: {status: string; notes: string}) {
  const key = `${w.profile.year}:${id}`;
  await db.update(lktWorkspaces).set({
    tasks: sql`jsonb_set(${lktWorkspaces.tasks}, ARRAY[${key}]::text[], ${JSON.stringify(value)}::jsonb, true)`,
  }).where(eq(lktWorkspaces.id, w.id));
}
export { and, desc, eq, db, lktActivities, lktMessages, lktWorkspaces, sql };
