import { Router, type IRouter } from "express";
import cookieParser from "cookie-parser";
import {
  GetCompanyResponse, SaveCompanyBody, SaveCompanyResponse, GetDashboardResponse,
  GetChecklistResponse, UpdateChecklistParams, UpdateChecklistBody, UpdateChecklistResponse,
  GetReferencesResponse, BookmarkReferenceParams, BookmarkReferenceBody, BookmarkReferenceResponse,
  GetProblemsResponse, GetActivityResponse,
} from "@workspace/api-zod";
import { activity, db, desc, eq, getTasks, lktActivities, lktMessages, lktWorkspaces, saveTask, sql } from "../lib/lkt-workspace";
import { references, problems } from "../lib/lkt-content";
import { withReviewReminder } from "../lib/lkt-reference-review";
import editorialRouter from "./lkt-editorial";
import { getEditorialReferences } from "../lib/lkt-editorial";
import consultationRouter from "./lkt-consultation";
import messageHistoryRouter from "./lkt-message-history";
import accountRouter from "./lkt-account";
import { requireLktAccount, requireLktOrganization } from "../lib/lkt-auth";
import referenceDigestRouter from "./lkt-reference-digest";
import reportCyclesRouter from "./lkt-report-cycles";
import reportFindingsRouter from "./lkt-report-findings";

const router: IRouter = Router();
const secret = process.env.SESSION_SECRET;
if (!secret) throw new Error("SESSION_SECRET is required to validate legacy workspace cookies");
router.use(cookieParser(secret));
router.use("/lkt", requireLktAccount);
router.use(accountRouter);
router.use(editorialRouter);
router.use("/lkt", requireLktOrganization);
router.use(referenceDigestRouter);
router.use(reportCyclesRouter);
router.use(reportFindingsRouter);

router.get("/lkt/company", (_req, res): void => {
  res.json(GetCompanyResponse.parse(res.locals.workspace.profile));
});
router.put("/lkt/company", async (req, res): Promise<void> => {
  const parsed = SaveCompanyBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.name.trim()) { res.status(400).json({ error: "Lengkapi nama, jenis perusahaan, standar dan tahun buku yang valid." }); return; }
  const profile = { ...parsed.data, name: parsed.data.name.trim() };
  await db.update(lktWorkspaces).set({ profile }).where(eq(lktWorkspaces.id, res.locals.workspace.id));
  await activity(res.locals.workspace.id, `Profil perusahaan diperbarui — tahun buku ${profile.year}`);
  res.json(SaveCompanyResponse.parse(profile));
});
router.get("/lkt/checklist", (_req, res): void => {
  res.json(GetChecklistResponse.parse(getTasks(res.locals.workspace)));
});
router.patch("/lkt/checklist/:id", async (req, res): Promise<void> => {
  const params = UpdateChecklistParams.safeParse(req.params);
  const body = UpdateChecklistBody.safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Status atau catatan tidak valid." }); return; }
  const task = getTasks(res.locals.workspace).find(t => t.id === params.data.id);
  if (!task) { res.status(404).json({ error: "Langkah persiapan tidak ditemukan untuk profil ini." }); return; }
  await saveTask(res.locals.workspace, task.id, body.data);
  await activity(res.locals.workspace.id, `${task.title}: ${body.data.status} (${res.locals.workspace.profile.year})`);
  res.json(UpdateChecklistResponse.parse({ ...task, ...body.data }));
});
router.get("/lkt/references", async (_req, res): Promise<void> => {
  const now = new Date();
  res.json(GetReferencesResponse.parse((await getEditorialReferences()).map(r => ({ ...withReviewReminder(r, now), bookmarked: res.locals.workspace.bookmarks[r.id] ?? false }))));
});
router.put("/lkt/references/:id/bookmark", async (req, res): Promise<void> => {
  const params = BookmarkReferenceParams.safeParse(req.params);
  const body = BookmarkReferenceBody.safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Permintaan simpan referensi tidak valid." }); return; }
  const ref = (await getEditorialReferences()).find(r => r.id === params.data.id);
  if (!ref) { res.status(404).json({ error: "Referensi tidak ditemukan." }); return; }
  await db.update(lktWorkspaces).set({
    bookmarks: sql`jsonb_set(${lktWorkspaces.bookmarks}, ARRAY[${ref.id}]::text[], ${JSON.stringify(body.data.bookmarked)}::jsonb, true)`,
  }).where(eq(lktWorkspaces.id, res.locals.workspace.id));
  await activity(res.locals.workspace.id, `${body.data.bookmarked ? "Menyimpan" : "Melepas simpanan"} referensi: ${ref.publisher}`);
  res.json(BookmarkReferenceResponse.parse({ ...withReviewReminder(ref), bookmarked: body.data.bookmarked }));
});
router.get("/lkt/problems", (_req, res): void => { res.json(GetProblemsResponse.parse(problems)); });
router.get("/lkt/activity", async (_req, res): Promise<void> => {
  const rows = await db.select().from(lktActivities).where(eq(lktActivities.workspaceId, res.locals.workspace.id)).orderBy(desc(lktActivities.createdAt)).limit(10);
  res.json(GetActivityResponse.parse(rows.map(r => ({ id: r.id, title: r.title, createdAt: r.createdAt.toISOString() }))));
});
router.get("/lkt/dashboard", async (_req, res): Promise<void> => {
  const tasks = getTasks(res.locals.workspace);
  const [{ value }] = await db.select({ value: sql<number>`count(*)::int` }).from(lktMessages).where(sql`${lktMessages.workspaceId} = ${res.locals.workspace.id} AND ${lktMessages.role} = 'assistant'`);
  const completed = tasks.filter(t => t.status === "selesai").length;
  res.json(GetDashboardResponse.parse({
    total: tasks.length, completed, inProgress: tasks.filter(t => t.status === "proses").length,
    progress: Math.round(completed / tasks.length * 100), referenceCount: references.length,
    consultationCount: value, nextSteps: tasks.filter(t => t.status !== "selesai").slice(0, 3),
  }));
});
router.use(messageHistoryRouter);
router.use(consultationRouter);
export default router;
