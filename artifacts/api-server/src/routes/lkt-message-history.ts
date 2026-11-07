import { Router, type IRouter } from "express";
import { GetMessagesQueryParams, GetMessagesResponse, GetConsultationMessageParams, GetConsultationMessageResponse } from "@workspace/api-zod";
import { InvalidMessageCursor, messagePage } from "../lib/lkt-workspace";

// Mounted only after account and company membership have been checked.
const router: IRouter = Router();
router.get("/lkt/messages/:id", async (req, res): Promise<void> => {
  const params = GetConsultationMessageParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "ID pesan tidak valid." }); return; }
  const message = (await messagePage(res.locals.workspace.id, { messageId: params.data.id })).messages[0];
  if (!message) { res.status(404).json({ error: "Pesan tidak tersedia di perusahaan ini atau telah dihapus." }); return; }
  res.json(GetConsultationMessageResponse.parse(message));
});
router.get("/lkt/messages", async (req, res): Promise<void> => {
  // Reject array/object query values rather than letting coercion stringify them.
  if (Object.keys(req.query).some(key => key !== "before" && key !== "limit" && key !== "q")
    || (req.query.q !== undefined && typeof req.query.q !== "string")
    || (req.query.before !== undefined && typeof req.query.before !== "string")
    || (req.query.limit !== undefined && typeof req.query.limit !== "string")) {
    res.status(400).json({ error: "Parameter riwayat tidak valid." });
    return;
  }
  const query = GetMessagesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Parameter riwayat tidak valid." });
    return;
  }
  try {
    res.json(GetMessagesResponse.parse(await messagePage(res.locals.workspace.id, query.data)));
  } catch (error) {
    if (!(error instanceof InvalidMessageCursor)) throw error;
    res.status(400).json({ error: error.message });
  }
});
export default router;
