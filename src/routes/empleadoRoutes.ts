import { Router } from "express";
import {
  listByDepartment,
  listByCompany,
  getById,
  createEmpleado,
  updateEmpleado,
} from "../controllers/EmpleadoController";
import { authenticateJWT } from "../middlewares/authMiddleware";
import { authorizeRoles } from "../middlewares/authorizeRoles";
import { Roles } from "../enums/roles";
import { uploadEmpleado } from "../middlewares/upload";

const router = Router();
router.use(authenticateJWT);

// GET /empleados/departamento - Solo SUPERVISOR
router.get(
  "/departamento",
  authorizeRoles(Roles.SUPERVISOR),
  listByDepartment
);

// GET /empleados/empresa - SUPERVISOR, RRHH, CONTABILIDAD, GERENCIA
router.get(
  "/empresa",
  authorizeRoles(Roles.SUPERVISOR, Roles.RRHH, Roles.CONTABILIDAD, Roles.GERENCIA),
  listByCompany
);

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
