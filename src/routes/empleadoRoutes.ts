import { Router } from "express";
import {
  listByDepartment,
  listByCompany,
  getById,
  createEmpleado,
  updateEmpleado,
  checkUsername,
} from "../controllers/EmpleadoController";
import { authenticateJWT } from "../middlewares/authMiddleware";
import { authorizeRoles } from "../middlewares/authorizeRoles";
import { Roles } from "../enums/roles";
import { uploadEmpleado } from "../middlewares/upload";

const router = Router();
router.use(authenticateJWT);

// GET /empleados/departamento - SUPERVISOR y SUPERVISOR_CONTABILIDAD
router.get(
  "/departamento",
  authorizeRoles(Roles.SUPERVISOR, Roles.SUPERVISOR_CONTABILIDAD),
  listByDepartment
);

// GET /empleados/empresa - SUPERVISOR, RRHH, SUPERVISOR_CONTABILIDAD, ASISTENTE_CONTABILIDAD, GERENCIA
router.get(
  "/empresa",
  authorizeRoles(Roles.SUPERVISOR, Roles.RRHH, Roles.SUPERVISOR_CONTABILIDAD, Roles.ASISTENTE_CONTABILIDAD, Roles.GERENCIA),
  listByCompany
);

// GET /empleados/check-username/:username - Verificar disponibilidad de nombre de usuario
router.get("/check-username/:username", checkUsername);

// GET /empleados/:id - Todos los autenticados pueden ver
router.get("/:id", getById);

// POST /empleados - Solo RRHH puede crear empleados
router.post(
  "/",
  authorizeRoles(Roles.RRHH),
  uploadEmpleado,
  createEmpleado
);

// PATCH /empleados - Solo RRHH puede actualizar empleados
router.patch(
  "/",
  authorizeRoles(Roles.RRHH),
  uploadEmpleado,
  updateEmpleado
);

export default router;
