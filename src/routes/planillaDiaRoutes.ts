import { Router } from "express";
import { authenticateJWT } from "../middlewares/authMiddleware";
import { upsertPlanillaDia } from "../controllers/PlanillaDiaController";

const router = Router({ mergeParams: true });
router.use(authenticateJWT);

router.post("/", upsertPlanillaDia);

export default router;
