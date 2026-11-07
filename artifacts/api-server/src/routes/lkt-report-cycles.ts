import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, lktReportCycles, lktWorkspaces, type LktReportCycle, type LktWorkspace } from "@workspace/db";
import {
  CreateReportCycleBody, CreateReportCycleResponse, GetReportCyclesResponse, GetReportCycleParams,
  GetReportCycleResponse, UpdateReportCycleBody, UpdateReportCycleParams, UpdateReportCycleResponse,
  UpdateReportCycleTaskBody, UpdateReportCycleTaskParams, UpdateReportCycleTaskResponse,
} from "@workspace/api-zod";
import { cycleSummary, cycleTasks, diagnoseCycle } from "../lib/lkt-report-readiness";
import { getEditorialReferences } from "../lib/lkt-editorial";

const router: IRouter = Router();
async function findCycle(workspaceId: string, id: string) {
  const [row] = await db.select().from(lktReportCycles).where(and(
    eq(lktReportCycles.workspaceId, workspaceId), eq(lktReportCycles.id, id),
  ));
  return row;
}
async function detail(cycle: LktReportCycle, workspace: LktWorkspace) {
  return diagnoseCycle(cycle, workspace, await getEditorialReferences());
}

router.get("/lkt/report-cycles", async (_req, res): Promise<void> => {
  const workspace: LktWorkspace = res.locals.workspace;
  const rows = await db.select().from(lktReportCycles).where(eq(lktReportCycles.workspaceId, workspace.id))
    .orderBy(desc(lktReportCycles.year));
  res.json(GetReportCyclesResponse.parse(rows.map(c => cycleSummary(c, workspace))));
});
router.post("/lkt/report-cycles", async (req, res): Promise<void> => {
  const body = CreateReportCycleBody.strict().safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Isi pengaturan ruang dan tahun buku 2020–2100 dengan benar." }); return; }
  const workspace: LktWorkspace = res.locals.workspace;
  const [row] = await db.insert(lktReportCycles).values({
    ...body.data, coordinator: body.data.coordinator.trim(), notes: body.data.notes.trim(),
    id: randomUUID(), workspaceId: workspace.id,
  }).onConflictDoNothing({ target: [lktReportCycles.workspaceId, lktReportCycles.year] }).returning();
  if (!row) { res.status(409).json({ error: "Ruang tahun buku ini sudah ada. Buka ruang yang tersedia; checklist lama tidak dihapus." }); return; }
  res.status(201).json(CreateReportCycleResponse.parse(await detail(row, workspace)));
});
router.get("/lkt/report-cycles/:id", async (req, res): Promise<void> => {
  const params = GetReportCycleParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "ID ruang tidak valid." }); return; }
  const workspace: LktWorkspace = res.locals.workspace;
  const row = await findCycle(workspace.id, params.data.id);
  if (!row) { res.status(404).json({ error: "Ruang laporan tidak ditemukan pada perusahaan ini." }); return; }
  res.json(GetReportCycleResponse.parse(await detail(row, workspace)));
});
router.put("/lkt/report-cycles/:id", async (req, res): Promise<void> => {
  const params = UpdateReportCycleParams.safeParse(req.params);
  const body = UpdateReportCycleBody.strict().safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Pengaturan ruang tidak valid. Tahun buku tidak dapat diganti." }); return; }
  const workspace: LktWorkspace = res.locals.workspace;
  const { expectedRevision, ...value } = body.data;
  const [row] = await db.update(lktReportCycles).set({
    ...value, coordinator: value.coordinator.trim(), notes: value.notes.trim(), updatedAt: new Date(),
    revision: sql`${lktReportCycles.revision} + 1`,
  }).where(and(eq(lktReportCycles.workspaceId, workspace.id), eq(lktReportCycles.id, params.data.id),
    eq(lktReportCycles.revision, expectedRevision))).returning();
  if (!row) {
    const exists = await findCycle(workspace.id, params.data.id);
    res.status(exists ? 409 : 404).json({ error: exists ? "Pengaturan diubah anggota lain. Muat ulang sebelum menyimpan." : "Ruang laporan tidak ditemukan." }); return;
  }
  res.json(UpdateReportCycleResponse.parse(await detail(row, workspace)));
});
router.put("/lkt/report-cycles/:id/tasks/:taskId", async (req, res): Promise<void> => {
  const params = UpdateReportCycleTaskParams.safeParse(req.params);
  const body = UpdateReportCycleTaskBody.strict().safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Status atau catatan langkah tidak valid." }); return; }
  const workspace: LktWorkspace = res.locals.workspace;
  // Serialize against settings changes so a task cannot be edited under a stale scope.
  const result = await db.transaction(async tx => {
    const [row] = await tx.select().from(lktReportCycles).where(and(
      eq(lktReportCycles.workspaceId, workspace.id), eq(lktReportCycles.id, params.data.id),
    )).for("share");
    if (!row || !cycleTasks(row, workspace).some(t => t.id === params.data.taskId)) return null;
    const key = `${row.year}:${params.data.taskId}`;
    const [updated] = await tx.update(lktWorkspaces).set({
      tasks: sql`jsonb_set(${lktWorkspaces.tasks}, ARRAY[${key}]::text[], ${JSON.stringify(body.data)}::jsonb, true)`,
    }).where(eq(lktWorkspaces.id, workspace.id)).returning();
    return { row, workspace: updated };
  });
  if (!result) { res.status(404).json({ error: "Ruang atau langkah tidak tersedia untuk profil tahun ini." }); return; }
  res.json(UpdateReportCycleTaskResponse.parse(await detail(result.row, result.workspace)));
});
export default router;
