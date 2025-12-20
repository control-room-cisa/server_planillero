// src/routes/job.routes.ts
import { Router } from "express";
import { authenticateJWT } from "../middlewares/authMiddleware";
import { authorizeRoles } from "../middlewares/authorizeRoles";
import { Roles } from "../enums/roles";
import {
  listJobs,
  getJob,
  createJob,
  updateJob,
  deleteJob,
} from "../controllers/JobController";

const router = Router();

// Protege todas las rutas con JWT
router.use(authenticateJWT);

// Listar todos los jobs (todos los autenticados pueden ver)
router.get("/", listJobs);

// Obtener un job por ID (todos los autenticados pueden ver)
router.get("/:id", getJob);

// Crear un nuevo job (solo CONTABILIDAD)
router.post(
  "/",
  authorizeRoles(Roles.CONTABILIDAD),
  createJob
);

// Actualizar un job existente (solo CONTABILIDAD)
router.put(
  "/:id",
  authorizeRoles(Roles.CONTABILIDAD),
  updateJob
);

// Eliminar (soft‐delete) un job (solo CONTABILIDAD)
router.delete(
  "/:id",
  authorizeRoles(Roles.CONTABILIDAD),
  deleteJob
);

export default router;
