import { Router } from "express";
import { authenticateJWT } from "../middlewares/authMiddleware";
import { getPeriodosNominaConfigHandler } from "../controllers/PeriodosNominaController";

const router = Router();

router.use(authenticateJWT);
router.get("/config", getPeriodosNominaConfigHandler);

export default router;
