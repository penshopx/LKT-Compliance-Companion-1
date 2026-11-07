import { Router, type IRouter } from "express";
import { SaveAccessNotificationsBody } from "@workspace/api-zod";
import { requireLktOwner } from "../lib/lkt-auth";
import { configureAccessNotifications, readAccessNotifications, stopAccessNotifications } from "../lib/lkt-access-notifications";

const router: IRouter = Router();
router.get("/lkt/access-notifications", requireLktOwner, async (_req, res): Promise<void> => {
  res.json(await readAccessNotifications(res.locals.organizationId, res.locals.userId));
});
router.put("/lkt/access-notifications", requireLktOwner, async (req, res): Promise<void> => {
  const parsed = SaveAccessNotificationsBody.strict().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Pilih tujuan Slack dan setujui pengiriman metadata perubahan akses." }); return; }
  res.json(await configureAccessNotifications(res.locals.organizationId, res.locals.userId, parsed.data));
});
router.delete("/lkt/access-notifications", requireLktOwner, async (_req, res): Promise<void> => {
  res.json(await stopAccessNotifications(res.locals.organizationId, res.locals.userId));
});
export default router;
