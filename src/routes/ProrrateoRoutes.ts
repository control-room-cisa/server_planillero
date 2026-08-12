// src/routes/ProrrateoRoutes.ts
import { Router, Request, Response, NextFunction } from "express";
import { authenticateJWT } from "../middlewares/authMiddleware";
import {
  guardarProrrateo,
  estadoProrrateoPorNomina,
} from "../controllers/ProrrateoController";
import { Roles } from "../enums/roles";
import { hasAnyRole } from "../utils/roles";

const router = Router();

router.use(authenticateJWT);

const puedeGestionarProrrateo = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const anyReq = req as any;
  if (
    !hasAnyRole(
      anyReq.user?.rolIds,
      Roles.SUPERVISOR_CONTABILIDAD,
      Roles.ASISTENTE_CONTABILIDAD,
      Roles.RRHH
    )
  ) {
    return res.status(403).json({
      success: false,
      message: "No autorizado",
      data: null,
    });
  }
  next();
};

router.use(puedeGestionarProrrateo);

/**
 * @route POST /api/prorrateos
 * @desc Calcula y guarda el snapshot de prorrateo de una nómina pagada
 * @body { nominaId: number }
 */
router.post("/", guardarProrrateo);

/**
 * @route GET /api/prorrateos/nomina/:nominaId/estado
 * @desc Indica si el prorrateo de la nómina ya fue guardado
 */
router.get("/nomina/:nominaId/estado", estadoProrrateoPorNomina);

export default router;
