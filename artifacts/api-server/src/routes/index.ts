import { Router, type IRouter } from "express";
import healthRouter from "./health";
import cctRouter from "./cct";
import authRouter from "./auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/cct", cctRouter);
router.use("/auth", authRouter);

export default router;
