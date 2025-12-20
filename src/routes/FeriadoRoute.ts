// src/routes/feriado.routes.ts
import { Router } from "express";
import { authenticateJWT } from "../middlewares/authMiddleware";
import { authorizeRoles } from "../middlewares/authorizeRoles";
import { Roles } from "../enums/roles";
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

// Listar todos los feriados (todos los autenticados pueden ver)
router.get("/", listFeriados);

// Obtener feriado por fecha (YYYY-MM-DD) (todos los autenticados pueden ver)
router.get("/:fecha", getFeriadoByDate);

// Crear un nuevo feriado (upsert) (solo RRHH)
router.post(
  "/",
  authorizeRoles(Roles.RRHH),
  createFeriado
);

// Actualizar un feriado por fecha (upsert) (solo RRHH)
router.put(
  "/:fecha",
  authorizeRoles(Roles.RRHH),
  upsertFeriado
);

// Eliminar (soft‐delete) un feriado (solo RRHH)
router.delete(
  "/:id",
  authorizeRoles(Roles.RRHH),
  deleteFeriado
);

export default router;
