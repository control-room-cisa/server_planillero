// src/routes/job.routes.ts
import { Router } from "express";
import { authenticateJWT } from "../middlewares/authMiddleware";
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

// Listar todos los jobs
router.get("/", listJobs);

// Obtener un job por ID
router.get("/:id", getJob);

// Crear un nuevo job
router.post("/", createJob);

// Actualizar un job existente
router.put("/:id", updateJob);

// Eliminar (soft‐delete) un job
router.delete("/:id", deleteJob);

export default router;
