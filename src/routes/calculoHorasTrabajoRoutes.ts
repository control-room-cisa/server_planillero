// src/routes/calculoHorasTrabajoRoutes.ts
import { Router } from "express";
import {
  getHorarioTrabajo,
  getConteoHoras,
} from "../controllers/CalculoHorasTrabajoController";
import { authenticateJWT } from "../middlewares/authMiddleware";

const router = Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(authenticateJWT);

/**
 * @route GET /api/calculo-horas/:empleadoId/horario/:fecha
 * @desc Obtiene el horario de trabajo de un empleado para una fecha específica
 * @access Private
 */
router.get("/:empleadoId/horario/:fecha", getHorarioTrabajo);

/**
 * @route GET /api/calculo-horas/:empleadoId/conteo-horas
 * @desc Obtiene el conteo de horas trabajadas por un empleado en un período
 * @query fechaInicio - Fecha de inicio (YYYY-MM-DD)
 * @query fechaFin - Fecha de fin (YYYY-MM-DD)
 * @access Private
 */
router.get("/:empleadoId/conteo-horas", getConteoHoras);

export default router;
