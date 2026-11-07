import { and, eq } from "drizzle-orm";
import { db, lktMessages } from "@workspace/db";
import { LktAccessError } from "./lkt-ai-limits";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function assertConsultationOrigin(tx: Tx, workspaceId: string, sourceId?: string) {
  if (sourceId === undefined) return;
  const [source] = await tx.select({ id: lktMessages.id }).from(lktMessages).where(and(
    eq(lktMessages.workspaceId, workspaceId), eq(lktMessages.id, sourceId), eq(lktMessages.role, "assistant"),
  ));
  if (!source) throw new LktAccessError(404, "Jawaban asal tidak tersedia di perusahaan ini atau telah dihapus.");
}
