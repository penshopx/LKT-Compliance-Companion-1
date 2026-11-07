import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, lktEvidenceArchives } from "@workspace/db";
import { GetEvidenceArchiveParams } from "@workspace/api-zod";
import { archiveFile, linkedEvent, verifyArchiveBytes } from "../lib/lkt-evidence-archive";
import { getEditorialReferences } from "../lib/lkt-editorial";

const router: IRouter = Router();
router.get("/lkt/evidence-archives/:id", async (req, res): Promise<void> => {
  const params = GetEvidenceArchiveParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "ID arsip tidak valid." }); return; }
  const [archive] = await db.select().from(lktEvidenceArchives).where(eq(lktEvidenceArchives.id, params.data.id));
  if (!archive) { res.status(404).json({ error: "Arsip tidak ditemukan." }); return; }
  try {
    const reference = (await getEditorialReferences()).find(r => r.id === archive.referenceId);
    if (!reference || !linkedEvent(reference, archive)) throw new Error("Unlinked archive");
    const [bytes] = await archiveFile(archive.objectPath).download();
    verifyArchiveBytes(bytes, archive);
    res.set({
      "Content-Type": archive.contentType === "text/plain" ? "text/plain; charset=utf-8" : archive.contentType,
      "Content-Disposition": `inline; filename="bukti-${archive.id.slice(0, 12)}.${{ "text/plain": "txt", "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg" }[archive.contentType] ?? "bin"}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'",
      "Cache-Control": "no-store",
      "X-Evidence-SHA256": archive.checksum,
    });
    res.send(bytes);
  } catch {
    req.log.error({ archiveId: archive.id }, "Evidence archive integrity or storage unavailable");
    res.status(503).json({ error: "Arsip belum dapat diperiksa atau integritasnya tidak cocok. Gunakan sumber asli; status verifikasi tidak berubah." });
  }
});
export default router;
