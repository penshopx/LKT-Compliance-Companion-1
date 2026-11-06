import { Router, type IRouter } from "express";
import { pipeline } from "node:stream/promises";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const storage = new ObjectStorageService();

// Deliberately allow only this curated public reference. No upload endpoint,
// arbitrary object path, or access to private company documents is exposed.
router.get("/lkt/reference-documents/setyorini-2007.pdf", async (_req, res): Promise<void> => {
  const file = await storage.searchPublicObject("references/setyorini-2007-laporan-tahunan.pdf");
  if (!file) {
    res.status(404).json({ error: "PDF referensi belum tersedia." });
    return;
  }
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'inline; filename="setyorini-2007-laporan-tahunan.pdf"');
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.setHeader("X-Content-Type-Options", "nosniff");
  await pipeline(file.createReadStream(), res);
});

export default router;
