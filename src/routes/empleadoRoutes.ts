import { Router } from "express";
import {
  listByDepartment,
  listByCompany,
  getById,
  createEmpleado,
  updateEmpleado,
  deleteEmpleado,
  checkUsername,
  updateMyProfile,
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

// PATCH /empleados/me/profile - Perfil propio (campos personales no sensibles)
router.patch("/me/profile", uploadEmpleado, updateMyProfile);

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

// DELETE /empleados/:id - Solo RRHH puede eliminar empleados
router.delete("/:id", authorizeRoles(Roles.RRHH), deleteEmpleado);

export default router;
