// src/routes/NominaRoutes.ts
import { Router } from "express";
import { authenticateJWT } from "../middlewares/authMiddleware";
import {
  leerNominas,
  crearNomina,
  actualizarNomina,
  leerNominasResumenPorEmpleado,
  leerNominaPorId,
  eliminarNomina,
} from "../controllers/NominaController";
import { Roles } from "../enums/roles";

const router = Router();

// Requiere sesión iniciada
router.use(authenticateJWT);

// Autorización por rol:
// - Lectura: RRHH o CONTABILIDAD
// - Escritura/actualización: solo RRHH

// GET /api/nominas (lectura)
router.get(
  "/",
  (req, res, next) => {
    const anyReq: any = req;
    if (
      anyReq.user?.rolId !== Roles.RRHH &&
      anyReq.user?.rolId !== Roles.CONTABILIDAD
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
      anyReq.user?.rolId !== Roles.CONTABILIDAD
    ) {
      return res
        .status(403)
        .json({ success: false, message: "No autorizado", data: null });
    }
    next();
  },
  leerNominasResumenPorEmpleado
);

// GET /api/nominas/:id (lectura)
router.get(
  "/:id",
  (req, res, next) => {
    const anyReq: any = req;
    if (
      anyReq.user?.rolId !== Roles.RRHH &&
      anyReq.user?.rolId !== Roles.CONTABILIDAD
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
