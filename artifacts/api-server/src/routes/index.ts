import { Router, type IRouter } from "express";
import healthRouter from "./health";
import lktRouter from "./lkt";

const router: IRouter = Router();

router.use(healthRouter);
router.use(lktRouter);

export default router;
