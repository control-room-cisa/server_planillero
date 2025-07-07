import { Router } from "express";
import { authenticateJWT } from "../middlewares/authMiddleware";
import {
  upsertRegistroDiario,
  getRegistroDiarioByDate
} from "../controllers/RegistroDiarioController";

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateJWT);

// POST /registros    → crea o actualiza
router.post("/", upsertRegistroDiario);

// GET  /registros?date=YYYY-MM-DD  → obtiene el registro con actividades→job
router.get("/", getRegistroDiarioByDate);

export default router;
