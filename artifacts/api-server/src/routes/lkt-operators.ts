import { Router, type IRouter, type RequestHandler } from "express";
import { asc, desc, eq } from "drizzle-orm";
import { db, lktOperators, lktEditors, lktEditorialAccessEvents } from "@workspace/db";
import {
  GetOperatorStatusResponse, GetEditorialAccessResponse,
  GrantEditorialAccessBody, GrantEditorialAccessResponse,
  RevokeEditorialAccessBody, RevokeEditorialAccessResponse,
} from "@workspace/api-zod";
import { changeEditorialAccess, resolveVerifiedAccount } from "../lib/lkt-operator-access";

const router: IRouter = Router();
const requireOperator: RequestHandler = async (_req, res, next) => {
  const [operator] = await db.select().from(lktOperators).where(eq(lktOperators.userId, res.locals.userId));
  if (!operator) { res.status(403).json({ error: "Izin operator tersendiri diperlukan; peran perusahaan maupun editor tidak mencukupi." }); return; }
  next();
};
router.get("/lkt/operator", async (_req, res): Promise<void> => {
  const [operator] = await db.select().from(lktOperators).where(eq(lktOperators.userId, res.locals.userId));
  res.json(GetOperatorStatusResponse.parse({ canManageEditors: !!operator }));
});
router.get("/lkt/operator/editorial-access", requireOperator, async (_req, res): Promise<void> => {
  const members = await db.select().from(lktEditors).orderBy(asc(lktEditors.displayName));
  const events = await db.select().from(lktEditorialAccessEvents).orderBy(desc(lktEditorialAccessEvents.id)).limit(100);
  res.json(GetEditorialAccessResponse.parse({ members, events: events.map(event => ({ ...event, createdAt: event.createdAt.toISOString() })) }));
});
router.post("/lkt/operator/editorial-access", requireOperator, async (req, res): Promise<void> => {
  const body = GrantEditorialAccessBody.strict().safeParse(req.body);
  if (!body.success || !body.data.displayName.trim() || !body.data.reason.trim()) {
    res.status(400).json({ error: "Isi email terverifikasi, nama dan alasan yang valid." }); return;
  }
  const targetUserId = await resolveVerifiedAccount(body.data.email.trim().toLowerCase());
  res.json(GrantEditorialAccessResponse.parse(await changeEditorialAccess(
    { source: "panel", userId: res.locals.userId },
    { role: "editor", action: "grant", targetUserId, displayName: body.data.displayName, reason: body.data.reason },
  )));
});
router.post("/lkt/operator/editorial-access/revoke", requireOperator, async (req, res): Promise<void> => {
  const body = RevokeEditorialAccessBody.strict().safeParse(req.body);
  if (!body.success || !body.data.userId.trim() || !body.data.reason.trim()) {
    res.status(400).json({ error: "Isi identitas dan alasan pencabutan yang valid." }); return;
  }
  res.json(RevokeEditorialAccessResponse.parse(await changeEditorialAccess(
    { source: "panel", userId: res.locals.userId },
    { role: "editor", action: "revoke", targetUserId: body.data.userId, displayName: "", reason: body.data.reason },
  )));
});
export default router;
