import { Router, type IRouter } from "express";
import healthRouter from "./health";
import lktRouter from "./lkt";
import referenceDocumentsRouter from "./lkt-reference-documents";
import evidenceArchivesRouter from "./lkt-evidence-archives";

const router: IRouter = Router();

router.use(healthRouter);
router.use(referenceDocumentsRouter);
router.use(evidenceArchivesRouter);
router.use(lktRouter);

export default router;
