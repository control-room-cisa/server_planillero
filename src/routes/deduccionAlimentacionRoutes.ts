// src/routes/deduccionAlimentacionRoutes.ts
import { Router } from "express";
import { getDeduccionAlimentacion } from "../controllers/DeduccionAlimentacionController";
import { authenticateJWT } from "../middlewares/authMiddleware";

const router = Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(authenticateJWT);

/**
 * @route GET /api/deduccion-alimentacion
 * @desc Obtiene las deducciones de alimentación de un empleado por código en un período
 * @query codigoEmpleado - Código del empleado
 * @query fechaInicio - Fecha de inicio (YYYY-MM-DD)
 * @query fechaFin - Fecha de fin (YYYY-MM-DD)
 * @access Private
 */
router.get("/", getDeduccionAlimentacion);

export default router;
