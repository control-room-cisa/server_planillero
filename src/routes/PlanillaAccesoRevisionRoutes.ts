// src/routes/PlanillaAccesoRevisionRoutes.ts
import { Router } from "express";
import { authenticateJWT } from "../middlewares/authMiddleware";
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

// Listar todos los accesos de planilla
router.get("/", listPlanillaAccesoRevision);

// Obtener un acceso de planilla por ID
router.get("/:id", getPlanillaAccesoRevision);

// Crear un nuevo acceso de planilla
router.post("/", createPlanillaAccesoRevision);

// Actualizar un acceso de planilla existente
router.put("/:id", updatePlanillaAccesoRevision);

// Eliminar (soft‐delete) un acceso de planilla
router.delete("/:id", deletePlanillaAccesoRevision);

export default router;




