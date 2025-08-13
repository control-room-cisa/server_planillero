// src/routes/empleadoDomainRoutes.ts
import { Router } from "express";
import {
  getHorarioTrabajo,
  getConteoHoras,
  getLineaTiempoDia,
  getTiposHorarioSoportados,
  getTiposHorarioPendientes,
} from "../controllers/EmpleadoDomainController";
import { authenticateJWT } from "../middlewares/authMiddleware";

const router = Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(authenticateJWT);

/**
 * @route GET /api/empleados/:empleadoId/horario/:fecha
 * @desc Obtiene el horario de trabajo de un empleado para una fecha específica
 * @access Private
 */
router.get("/:empleadoId/horario/:fecha", getHorarioTrabajo);

/**
 * @route GET /api/empleados-domain/:empleadoId/conteo-horas
 * @desc Obtiene el conteo de horas trabajadas por un empleado en un período
 * @query fechaInicio - Fecha de inicio (YYYY-MM-DD)
 * @query fechaFin - Fecha de fin (YYYY-MM-DD)
 * @access Private
 */
router.get("/:empleadoId/conteo-horas", getConteoHoras);

/**
 * @route GET /api/empleados-domain/:empleadoId/linea-tiempo/:fecha
 * @desc Segmenta el día en intervalos de tiempo para un empleado y fecha específica
 * @access Private
 */
router.get("/:empleadoId/linea-tiempo/:fecha", getLineaTiempoDia);

/**
 * @route GET /api/empleados-domain/tipos-horario/soportados
 * @desc Obtiene los tipos de horario soportados
 * @access Private
 */
router.get("/tipos-horario/soportados", getTiposHorarioSoportados);

/**
 * @route GET /api/empleados-domain/tipos-horario/pendientes
 * @desc Obtiene los tipos de horario pendientes de implementación
 * @access Private
 */
router.get("/tipos-horario/pendientes", getTiposHorarioPendientes);

export default router;
