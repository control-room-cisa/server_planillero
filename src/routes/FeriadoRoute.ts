// src/routes/feriado.routes.ts
import { Router } from "express";
import { authenticateJWT } from "../middlewares/authMiddleware";
import {
  listFeriados,
  getFeriadoByDate,
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

// Crear y actualizar un nuevo feriado
router.post("/", upsertFeriado);

// Eliminar (soft‐delete) un feriado
router.delete("/:id", deleteFeriado);

export default router;
