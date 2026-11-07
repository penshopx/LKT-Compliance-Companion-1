import { Router, type IRouter } from "express";
import { SaveReferenceDigestBody, SaveReferenceDigestResponse, StopReferenceDigestResponse } from "@workspace/api-zod";
import { requireLktOwner } from "../lib/lkt-auth";
import { configureReferenceDigest, readReferenceDigest, stopReferenceDigest } from "../lib/lkt-reference-digest";
import { LktAccessError } from "../lib/lkt-ai-limits";

const router: IRouter = Router();
router.get("/lkt/reference-digest", async (_req, res): Promise<void> => {
  res.json(await readReferenceDigest(res.locals.organizationId, res.locals.membership.role === "owner"));
});
router.put("/lkt/reference-digest", requireLktOwner, async (req, res): Promise<void> => {
  const parsed = SaveReferenceDigestBody.strict().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Pilih tujuan Slack, jadwal WIB, dan persetujuan pengiriman yang valid." }); return; }
  try {
    res.json(SaveReferenceDigestResponse.parse(await configureReferenceDigest(res.locals.organizationId, res.locals.userId, parsed.data)));
  } catch (error) {
    if (!(error instanceof LktAccessError)) throw error;
    res.status(error.status).json({ error: error.message });
  }
});
router.delete("/lkt/reference-digest", requireLktOwner, async (_req, res): Promise<void> => {
  try {
    res.json(StopReferenceDigestResponse.parse(await stopReferenceDigest(res.locals.organizationId, res.locals.userId)));
  } catch (error) {
    if (!(error instanceof LktAccessError)) throw error;
    res.status(error.status).json({ error: error.message });
  }
});
export default router;
