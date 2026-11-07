import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
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

export async function messagePage(id: string, { before, limit = 80 }: { before?: string; limit?: number } = {}) {
  let anchorId: string | undefined;
  if (before !== undefined) {
    let cursor: { v: number; workspace: string; id: string };
    try {
      cursor = JSON.parse(Buffer.from(before, "base64url").toString("utf8"));
      if (cursor.v !== 1 || cursor.workspace !== id || typeof cursor.id !== "string") throw new Error();
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
  const rows = await db.select().from(lktMessages)
    .where(and(eq(lktMessages.workspaceId, id), older))
    .orderBy(desc(lktMessages.createdAt), desc(lktMessages.id)).limit(limit + 1);
  const hasOlder = rows.length > limit;
  const page = rows.slice(0, limit);
  const oldest = page.at(-1);
  const currentVersion = createReferenceSnapshot(await getEditorialReferences()).knowledgeVersion;
  return {
    nextCursor: hasOlder && oldest ? Buffer.from(JSON.stringify({ v: 1, workspace: id, id: oldest.id })).toString("base64url") : null,
    // The lookahead row also resolves a question outside this page. Do not
    // search past an orphan assistant or guess the order of tied timestamps.
    messages: page.map((m, index) => {
      const previous = rows[index + 1];
      const originalQuestion = m.role === "assistant" && previous?.role === "user"
        && previous.createdAt.getTime() < m.createdAt.getTime()
        && previous.content.trim()
        ? { id: previous.id, content: previous.content } : null;
      return {
        id: m.id, role: m.role, content: m.content, createdAt: m.createdAt.toISOString(),
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
