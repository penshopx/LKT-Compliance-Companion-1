import { Router, type IRouter } from "express";
import healthRouter from "./health";
import lktRouter from "./lkt";
import referenceDocumentsRouter from "./lkt-reference-documents";

const router: IRouter = Router();

router.use(healthRouter);
router.use(referenceDocumentsRouter);
router.use(lktRouter);

export default router;
