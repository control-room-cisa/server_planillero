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
  descargarPlantillaPago,
  pagarPlanilla,
} from "../controllers/NominaController";
import { Roles } from "../enums/roles";

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
  if (anyReq.user?.rolId !== Roles.SUPERVISOR_CONTABILIDAD) {
    return res
      .status(403)
      .json({ success: false, message: "Solo supervisor de contabilidad", data: null });
  }
  next();
};

// GET /api/nominas (lectura)
router.get(
  "/",
  (req, res, next) => {
    const anyReq: any = req;
    if (
      anyReq.user?.rolId !== Roles.RRHH &&
      anyReq.user?.rolId !== Roles.SUPERVISOR_CONTABILIDAD &&
      anyReq.user?.rolId !== Roles.ASISTENTE_CONTABILIDAD
    ) {
      return res
        .status(403)
        .json({ success: false, message: "No autorizado", data: null });
    }
    next();
  },
  leerNominas
);

// GET /api/nominas/resumen?empleadoId=... (lectura)
router.get(
  "/resumen",
  (req, res, next) => {
    const anyReq: any = req;
    if (
      anyReq.user?.rolId !== Roles.RRHH &&
      anyReq.user?.rolId !== Roles.SUPERVISOR_CONTABILIDAD &&
      anyReq.user?.rolId !== Roles.ASISTENTE_CONTABILIDAD
    ) {
      return res
        .status(403)
        .json({ success: false, message: "No autorizado", data: null });
    }
    next();
  },
  leerNominasResumenPorEmpleado
);

// GET /api/nominas/plantilla-pago?empresaId=&codigoNomina=
router.get(
  "/plantilla-pago",
  soloSupervisorContabilidad,
  descargarPlantillaPago
);

// POST /api/nominas/pagar-planilla
router.post("/pagar-planilla", soloSupervisorContabilidad, pagarPlanilla);

// GET /api/nominas/:id (lectura)
router.get(
  "/:id",
  (req, res, next) => {
    const anyReq: any = req;
    if (
      anyReq.user?.rolId !== Roles.RRHH &&
      anyReq.user?.rolId !== Roles.SUPERVISOR_CONTABILIDAD &&
      anyReq.user?.rolId !== Roles.ASISTENTE_CONTABILIDAD
    ) {
      return res
        .status(403)
        .json({ success: false, message: "No autorizado", data: null });
    }
    next();
  },
  leerNominaPorId
);

// POST /api/nominas
router.post(
  "/",
  (req, res, next) => {
    const anyReq: any = req;
    if (anyReq.user?.rolId !== Roles.RRHH) {
      return res
        .status(403)
        .json({ success: false, message: "Solo RRHH", data: null });
    }
    next();
  },
  crearNomina
);

// PUT /api/nominas/:id
router.put(
  "/:id",
  (req, res, next) => {
    const anyReq: any = req;
    if (anyReq.user?.rolId !== Roles.RRHH) {
      return res
        .status(403)
        .json({ success: false, message: "Solo RRHH", data: null });
    }
    next();
  },
  actualizarNomina
);

// DELETE /api/nominas/:id
router.delete(
  "/:id",
  (req, res, next) => {
    const anyReq: any = req;
    if (anyReq.user?.rolId !== Roles.RRHH) {
      return res
        .status(403)
        .json({ success: false, message: "Solo RRHH", data: null });
    }
    next();
  },
  eliminarNomina
);

export default router;
