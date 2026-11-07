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
export async function recentMessages(id: string) {
  const currentVersion = createReferenceSnapshot(await getEditorialReferences()).knowledgeVersion;
  return (await db.select().from(lktMessages).where(eq(lktMessages.workspaceId, id)).orderBy(desc(lktMessages.createdAt), desc(lktMessages.id)).limit(80))
    .reverse().map(m => ({
      id: m.id, role: m.role, content: m.content, createdAt: m.createdAt.toISOString(),
      referenceSnapshot: m.referenceSnapshot,
      referenceFreshness: referenceFreshness(m.role, m.referenceSnapshot, currentVersion),
    }));
}
export async function saveTask(w: LktWorkspace, id: string, value: {status: string; notes: string}) {
  const key = `${w.profile.year}:${id}`;
  await db.update(lktWorkspaces).set({
    tasks: sql`jsonb_set(${lktWorkspaces.tasks}, ARRAY[${key}]::text[], ${JSON.stringify(value)}::jsonb, true)`,
  }).where(eq(lktWorkspaces.id, w.id));
}
export { and, desc, eq, db, lktActivities, lktMessages, lktWorkspaces, sql };
