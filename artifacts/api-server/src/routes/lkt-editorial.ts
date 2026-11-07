import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { db, lktEditors } from "@workspace/db";
import { GetEditorialWorkspaceResponse, AppendEditorialEventParams, AppendEditorialEventBody, AppendEditorialEventResponse } from "@workspace/api-zod";
import { appendEditorialEvent, getEditorialReferences } from "../lib/lkt-editorial";

// Mounted after account authentication but BEFORE company membership checks.
const router: IRouter = Router();
router.get("/lkt/editorial", async (_req, res): Promise<void> => {
  const [editor] = await db.select().from(lktEditors).where(eq(lktEditors.userId, res.locals.userId));
  const members = editor ? await db.select().from(lktEditors).orderBy(asc(lktEditors.displayName)) : [];
  res.json(GetEditorialWorkspaceResponse.parse({
    canEdit: !!editor, members, references: editor ? await getEditorialReferences() : [],
  }));
});
router.post("/lkt/editorial/references/:id/events", async (req, res): Promise<void> => {
  const [editor] = await db.select().from(lktEditors).where(eq(lktEditors.userId, res.locals.userId));
  if (!editor) { res.status(403).json({ error: "Akses redaksi diperlukan; peran perusahaan tidak memberi izin ini." }); return; }
  const params = AppendEditorialEventParams.safeParse(req.params);
  const body = AppendEditorialEventBody.strict().safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Lengkapi data snapshot, penanggung jawab, alasan dan tanggal kalender." }); return; }
  res.status(201).json(AppendEditorialEventResponse.parse(await appendEditorialEvent(editor.userId, params.data.id, body.data)));
});
export default router;
