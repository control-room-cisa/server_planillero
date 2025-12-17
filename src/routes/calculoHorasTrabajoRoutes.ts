// src/routes/calculoHorasTrabajoRoutes.ts
import { Router } from "express";
import {
  getHorarioTrabajo,
  getConteoHoras,
  getProrrateo,
  getDeduccionesAlimentacion,
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

/**
 * @route GET /api/calculo-horas/:empleadoId/prorrateo
 * @desc Obtiene el prorrateo de horas por job de un empleado en un período
 * @query fechaInicio - Fecha de inicio (YYYY-MM-DD)
 * @query fechaFin - Fecha de fin (YYYY-MM-DD)
 * @access Private
 */
router.get("/:empleadoId/prorrateo", getProrrateo);

/**
 * @route GET /api/calculo-horas/:empleadoId/deducciones-alimentacion
 * @desc Obtiene las deducciones de alimentación de un empleado en un período
 * @query fechaInicio - Fecha de inicio (YYYY-MM-DD)
 * @query fechaFin - Fecha de fin (YYYY-MM-DD)
 * @access Private
 */
router.get("/:empleadoId/deducciones-alimentacion", getDeduccionesAlimentacion);

export default router;
