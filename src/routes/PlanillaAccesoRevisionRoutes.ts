// src/routes/PlanillaAccesoRevisionRoutes.ts
import { Router } from "express";
import { authenticateJWT } from "../middlewares/authMiddleware";
import { authorizeRoles } from "../middlewares/authorizeRoles";
import { Roles } from "../enums/roles";
import {
  listPlanillaAccesoRevision,
  getPlanillaAccesoRevision,
  createPlanillaAccesoRevision,
  updatePlanillaAccesoRevision,
  deletePlanillaAccesoRevision,
} from "../controllers/PlanillaAccesoRevisionController";

const router = Router();

// Protege todas las rutas con JWT
router.use(authenticateJWT);

// Listar todos los accesos de planilla (solo SUPERVISOR o RRHH)
router.get(
  "/",
  authorizeRoles(Roles.SUPERVISOR, Roles.RRHH),
  listPlanillaAccesoRevision
);

// Obtener un acceso de planilla por ID (solo SUPERVISOR o RRHH)
router.get(
  "/:id",
  authorizeRoles(Roles.SUPERVISOR, Roles.RRHH),
  getPlanillaAccesoRevision
);

// Crear un nuevo acceso de planilla (solo SUPERVISOR o RRHH)
router.post(
  "/",
  authorizeRoles(Roles.SUPERVISOR, Roles.RRHH),
  createPlanillaAccesoRevision
);

// Actualizar un acceso de planilla existente (solo SUPERVISOR o RRHH)
router.put(
  "/:id",
  authorizeRoles(Roles.SUPERVISOR, Roles.RRHH),
  updatePlanillaAccesoRevision
);

// Eliminar (soft‐delete) un acceso de planilla (solo SUPERVISOR o RRHH)
router.delete(
  "/:id",
  authorizeRoles(Roles.SUPERVISOR, Roles.RRHH),
  deletePlanillaAccesoRevision
);

export default router;








