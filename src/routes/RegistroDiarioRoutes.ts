import { Router } from "express";
import { authenticateJWT } from "../middlewares/authMiddleware";
import {
  upsertRegistroDiario,
  getRegistroDiarioByDate,
  aprobacionRrhh,
  aprobacionSupervisor,
  updateJobBySupervisor,
} from "../controllers/RegistroDiarioController";

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateJWT);

// POST /registros    → crea o actualiza
router.post("/", upsertRegistroDiario);

// GET  /registros?date=YYYY-MM-DD  → obtiene el registro con actividades→job
router.get("/", getRegistroDiarioByDate);

router.patch("/aprobacion-supervisor/:id", aprobacionSupervisor);

// PATCH  /registros/:id/aprobacion-rrhh
//         → actualiza aprobación, código y comentario de RRHH
router.patch("/aprobacion-rrhh/:id", aprobacionRrhh);

// PATCH /registros/update-job-supervisor
//       → permite a supervisores actualizar jobs de actividades de otros empleados
router.patch("/update-job-supervisor", updateJobBySupervisor);

export default router;
