import { Router, type IRouter } from "express";
import healthRouter from "./health";
import lktRouter from "./lkt";
import referenceDocumentsRouter from "./lkt-reference-documents";
import evidenceArchivesRouter from "./lkt-evidence-archives";
import digestEmailConsentRouter from "./lkt-digest-email-consent";

const router: IRouter = Router();

router.use(healthRouter);
router.use(referenceDocumentsRouter);
router.use(evidenceArchivesRouter);
router.use(digestEmailConsentRouter);
router.use(lktRouter);

export default router;
