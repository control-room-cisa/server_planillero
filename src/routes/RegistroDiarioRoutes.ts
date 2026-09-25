import { Router } from "express";
import { authenticateJWT } from "../middlewares/authMiddleware";
import { authorizeRoles } from "../middlewares/authorizeRoles";
import { Roles } from "../enums/roles";
import {
  upsertRegistroDiario,
  getRegistroDiarioByDate,
  aprobacionRrhh,
  aprobacionSupervisor,
  updateJobBySupervisor,
  getTiempoCompensatorio,
} from "../controllers/RegistroDiarioController";

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateJWT);

// POST /registros    → crea o actualiza
router.post("/", upsertRegistroDiario);

// GET  /registros?date=YYYY-MM-DD  → obtiene el registro con actividades→job
router.get("/", getRegistroDiarioByDate);

// GET /registrodiario/tiempo-compensatorio?idEmpleado=
router.get("/tiempo-compensatorio", getTiempoCompensatorio);

router.patch(
  "/aprobacion-supervisor/:id",
  authorizeRoles(Roles.SUPERVISOR),
  aprobacionSupervisor
);

// PATCH  /registros/:id/aprobacion-rrhh
//         → actualiza aprobación, código y comentario de RRHH
router.patch(
  "/aprobacion-rrhh/:id",
  authorizeRoles(Roles.RRHH),
  aprobacionRrhh
);

// PATCH /registros/update-job-supervisor
//       → permite a supervisores actualizar jobs de actividades de otros empleados
router.patch("/update-job-supervisor", updateJobBySupervisor);

export default router;
