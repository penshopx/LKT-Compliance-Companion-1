import { randomUUID } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, lktReportCycles, lktReportFindings, lktReportFindingEvents, type LktReportFinding } from "@workspace/db";
import {
  CreateReportFindingBody, CreateReportFindingParams, CreateReportFindingResponse,
  GetReportFindingsParams, GetReportFindingsResponse, UpdateReportFindingParams,
  UpdateReportFindingBody, UpdateReportFindingResponse, GetReportFindingHistoryParams, GetReportFindingHistoryResponse,
} from "@workspace/api-zod";
import { lockOrganization, assertMembership, LktAccessError } from "../lib/lkt-ai-limits";
import { findingValidationError, normalizeFinding } from "../lib/lkt-report-findings";

const router: IRouter = Router();
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Serialize with membership revocation as well as concurrent finding updates.
async function authorizedCycle(tx: Tx, res: Response, id: string) {
  await lockOrganization(tx, res.locals.organizationId);
  await assertMembership(tx, res.locals.organizationId, res.locals.userId);
  const [cycle] = await tx.select().from(lktReportCycles).where(and(
    eq(lktReportCycles.id, id), eq(lktReportCycles.workspaceId, res.locals.workspace.id),
  ));
  if (!cycle) throw new LktAccessError(404, "Ruang laporan tidak ditemukan pada perusahaan ini.");
  return cycle;
}
function serialize(row: LktReportFinding) {
  return {
    ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
    closedAt: row.closedAt?.toISOString() ?? null,
  };
}
async function journal(tx: Tx, row: LktReportFinding, userId: string) {
  await tx.insert(lktReportFindingEvents).values({
    id: randomUUID(), findingId: row.id, revision: row.revision,
    actorUserId: userId, snapshot: serialize(row),
  });
}
const handle = (action: (req: Request, res: Response) => Promise<void>) =>
  async (req: Request, res: Response) => {
    try { await action(req, res); }
    catch (error) {
      if (error instanceof LktAccessError) { res.status(error.status).json({ error: error.message }); return; }
      throw error;
    }
  };

router.get("/lkt/report-cycles/:id/findings", handle(async (req, res) => {
  const params = GetReportFindingsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "ID ruang laporan tidak valid." }); return; }
  const rows = await db.transaction(async tx => {
    const cycle = await authorizedCycle(tx, res, params.data.id);
    return tx.select().from(lktReportFindings).where(eq(lktReportFindings.reportCycleId, cycle.id))
      .orderBy(desc(lktReportFindings.updatedAt), desc(lktReportFindings.id));
  });
  res.json(GetReportFindingsResponse.parse(rows.map(serialize)));
}));

router.post("/lkt/report-cycles/:id/findings", handle(async (req, res) => {
  const params = CreateReportFindingParams.safeParse(req.params);
  const body = CreateReportFindingBody.strict().safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Isian temuan tidak valid atau melebihi batas panjang." }); return; }
  const value = normalizeFinding(body.data);
  const error = findingValidationError(value);
  if (error) { res.status(400).json({ error }); return; }
  const row = await db.transaction(async tx => {
    const cycle = await authorizedCycle(tx, res, params.data.id);
    const now = new Date();
    const [created] = await tx.insert(lktReportFindings).values({
      ...value, sourceDiagnosisId: value.sourceDiagnosisId || null, id: randomUUID(), reportCycleId: cycle.id,
      closedAt: value.status === "ditutup" ? now : null,
      closedByUserId: value.status === "ditutup" ? res.locals.userId : null,
    }).returning();
    await journal(tx, created, res.locals.userId);
    return created;
  });
  res.status(201).json(CreateReportFindingResponse.parse(serialize(row)));
}));

router.put("/lkt/report-cycles/:id/findings/:findingId", handle(async (req, res) => {
  const params = UpdateReportFindingParams.safeParse(req.params);
  const body = UpdateReportFindingBody.strict().safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Isian atau revisi temuan tidak valid." }); return; }
  const { expectedRevision, ...value } = normalizeFinding(body.data);
  const error = findingValidationError(body.data);
  if (error) { res.status(400).json({ error }); return; }
  const row = await db.transaction(async tx => {
    await authorizedCycle(tx, res, params.data.id);
    const [old] = await tx.select().from(lktReportFindings).where(and(
      eq(lktReportFindings.id, params.data.findingId), eq(lktReportFindings.reportCycleId, params.data.id),
    )).for("update");
    if (!old) throw new LktAccessError(404, "Temuan tidak ditemukan pada ruang tahun buku ini.");
    if (old.revision !== expectedRevision) throw new LktAccessError(409, "Temuan sudah diubah anggota tim lain. Isian Anda belum disimpan; muat versi terbaru sebelum mencoba kembali.");
    const now = new Date();
    const [updated] = await tx.update(lktReportFindings).set({
      ...value, revision: old.revision + 1, updatedAt: now,
      closedAt: value.status === "ditutup" ? old.closedAt ?? now : null,
      closedByUserId: value.status === "ditutup" ? old.closedByUserId ?? res.locals.userId : null,
    }).where(eq(lktReportFindings.id, old.id)).returning();
    await journal(tx, updated, res.locals.userId);
    return updated;
  });
  res.json(UpdateReportFindingResponse.parse(serialize(row)));
}));

router.get("/lkt/report-cycles/:id/findings/:findingId/history", handle(async (req, res) => {
  const params = GetReportFindingHistoryParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "ID temuan tidak valid." }); return; }
  const events = await db.transaction(async tx => {
    await authorizedCycle(tx, res, params.data.id);
    const [finding] = await tx.select({ id: lktReportFindings.id }).from(lktReportFindings).where(and(
      eq(lktReportFindings.id, params.data.findingId), eq(lktReportFindings.reportCycleId, params.data.id),
    ));
    if (!finding) throw new LktAccessError(404, "Temuan tidak ditemukan pada ruang tahun buku ini.");
    return tx.select().from(lktReportFindingEvents).where(eq(lktReportFindingEvents.findingId, finding.id))
      .orderBy(desc(lktReportFindingEvents.revision));
  });
  res.json(GetReportFindingHistoryResponse.parse(events.map(e => ({ ...e, createdAt: e.createdAt.toISOString() }))));
}));

export default router;
