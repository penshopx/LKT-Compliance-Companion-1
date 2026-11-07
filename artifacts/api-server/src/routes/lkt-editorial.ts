import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { db, lktEditors, lktEditorialDrafts } from "@workspace/db";
import { GetEditorialWorkspaceResponse, AppendEditorialEventParams, AppendEditorialEventBody, AppendEditorialEventResponse } from "@workspace/api-zod";
import { appendEditorialEvent, getEditorialReferences } from "../lib/lkt-editorial";
import { CreateEditorialDraftBody, CreateEditorialDraftParams, CreateEditorialDraftResponse, UpdateEditorialDraftBody, UpdateEditorialDraftParams, UpdateEditorialDraftResponse, ApproveEditorialDraftBody, ApproveEditorialDraftParams, ApproveEditorialDraftResponse } from "@workspace/api-zod";
import { approveEditorialDraft, draftResponse, saveEditorialDraft } from "../lib/lkt-editorial-drafts";

// Mounted after account authentication but BEFORE company membership checks.
const router: IRouter = Router();
router.get("/lkt/editorial", async (_req, res): Promise<void> => {
  const [editor] = await db.select().from(lktEditors).where(eq(lktEditors.userId, res.locals.userId));
  const members = editor ? await db.select().from(lktEditors).orderBy(asc(lktEditors.displayName)) : [];
  res.json(GetEditorialWorkspaceResponse.parse({
    canEdit: !!editor, currentUserId: res.locals.userId, members, references: editor ? await getEditorialReferences() : [],
    drafts: editor ? (await db.select().from(lktEditorialDrafts).where(eq(lktEditorialDrafts.status, "draft")).orderBy(asc(lktEditorialDrafts.id))).map(draftResponse) : [],
  }));
});
router.post("/lkt/editorial/references/:id/drafts", async (req, res): Promise<void> => {
  const params = CreateEditorialDraftParams.safeParse(req.params);
  const body = CreateEditorialDraftBody.strict().safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Data draf tidak valid." }); return; }
  res.status(201).json(CreateEditorialDraftResponse.parse(await saveEditorialDraft(res.locals.userId, params.data.id, body.data)));
});
router.put("/lkt/editorial/drafts/:id", async (req, res): Promise<void> => {
  const params = UpdateEditorialDraftParams.safeParse(req.params);
  const body = UpdateEditorialDraftBody.strict().safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Data revisi draf tidak valid." }); return; }
  const [draft] = await db.select().from(lktEditorialDrafts).where(eq(lktEditorialDrafts.id, params.data.id));
  if (!draft) { res.status(404).json({ error: "Draf tidak ditemukan." }); return; }
  res.json(UpdateEditorialDraftResponse.parse(await saveEditorialDraft(res.locals.userId, draft.referenceId, body.data.input, draft.id, body.data.expectedVersion)));
});
router.post("/lkt/editorial/drafts/:id/approve", async (req, res): Promise<void> => {
  const params = ApproveEditorialDraftParams.safeParse(req.params);
  const body = ApproveEditorialDraftBody.strict().safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Data persetujuan tidak valid." }); return; }
  res.status(201).json(ApproveEditorialDraftResponse.parse(await approveEditorialDraft(res.locals.userId, params.data.id, body.data)));
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
