// src/routes/feriado.routes.ts
import { Router } from "express";
import { authenticateJWT } from "../middlewares/authMiddleware";
import {
  listFeriados,
  getFeriadoByDate,
  createFeriado,
  upsertFeriado,
  deleteFeriado,
} from "../controllers/FeriadoController";

const router = Router();

// Protege todas las rutas con JWT
router.use(authenticateJWT);

// Listar todos los feriados
router.get("/", listFeriados);

// Obtener feriado por fecha (YYYY-MM-DD)
router.get("/:fecha", getFeriadoByDate);

// Crear un nuevo feriado (upsert)
router.post("/", createFeriado);

// Actualizar un feriado por fecha (upsert)
router.put("/:fecha", upsertFeriado);

// Eliminar (soft‐delete) un feriado
router.delete("/:id", deleteFeriado);

export default router;
