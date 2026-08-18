// src/routes/NominaRoutes.ts
import { Router, Request, Response, NextFunction } from "express";
import { authenticateJWT } from "../middlewares/authMiddleware";
import {
  leerNominas,
  crearNomina,
  actualizarNomina,
  leerNominasResumenPorEmpleado,
  leerNominaPorId,
  eliminarNomina,
  descargarDetalleNomina,
  descargarTablaDetallesNominas,
  descargarPlantillaPago,
  pagarPlanilla,
} from "../controllers/NominaController";
import { Roles } from "../enums/roles";
import { hasAnyRole } from "../utils/roles";

const router = Router();

// Requiere sesión iniciada
router.use(authenticateJWT);

// Autorización por rol:
// - Lectura: RRHH, SUPERVISOR_CONTABILIDAD o ASISTENTE_CONTABILIDAD
// - Escritura/actualización: solo RRHH
// - Plantilla de pago y pagar planilla: solo SUPERVISOR_CONTABILIDAD

const soloSupervisorContabilidad = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const anyReq = req as any;
  if (!hasAnyRole(anyReq.user?.rolIds, Roles.SUPERVISOR_CONTABILIDAD)) {
    return res
      .status(403)
      .json({ success: false, message: "Solo supervisor de contabilidad", data: null });
  }
  next();
};

const puedeLeerNominas = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const anyReq: any = req;
  if (
    !hasAnyRole(
      anyReq.user?.rolIds,
      Roles.RRHH,
      Roles.SUPERVISOR_CONTABILIDAD,
      Roles.ASISTENTE_CONTABILIDAD
    )
  ) {
    return res
      .status(403)
      .json({ success: false, message: "No autorizado", data: null });
  }
  next();
};

const soloRrhh = (req: Request, res: Response, next: NextFunction) => {
  const anyReq: any = req;
  if (!hasAnyRole(anyReq.user?.rolIds, Roles.RRHH)) {
    return res
      .status(403)
      .json({ success: false, message: "Solo RRHH", data: null });
  }
  next();
};

// GET /api/nominas (lectura)
router.get("/", puedeLeerNominas, leerNominas);

// GET /api/nominas/resumen?empleadoId=... (lectura)
router.get("/resumen", puedeLeerNominas, leerNominasResumenPorEmpleado);

// GET /api/nominas/detalle-tabla?empresaId=&codigoNomina=
router.get(
  "/detalle-tabla",
  puedeLeerNominas,
  descargarTablaDetallesNominas
);

// GET /api/nominas/plantilla-pago?empresaId=&codigoNomina=
router.get(
  "/plantilla-pago",
  soloSupervisorContabilidad,
  descargarPlantillaPago
);

// POST /api/nominas/pagar-planilla
router.post("/pagar-planilla", soloSupervisorContabilidad, pagarPlanilla);

// GET /api/nominas/:id/detalle-excel (lectura)
router.get("/:id/detalle-excel", puedeLeerNominas, descargarDetalleNomina);

// GET /api/nominas/:id (lectura)
router.get("/:id", puedeLeerNominas, leerNominaPorId);

// POST /api/nominas
router.post("/", soloRrhh, crearNomina);

// PUT /api/nominas/:id
router.put("/:id", soloRrhh, actualizarNomina);

// DELETE /api/nominas/:id
router.delete("/:id", soloRrhh, eliminarNomina);

export default router;
