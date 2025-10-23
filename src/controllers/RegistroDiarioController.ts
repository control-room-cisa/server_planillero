// src/controllers/RegistroDiarioController.ts
import { RequestHandler } from "express";
import { RegistroDiarioService } from "../services/RegistroDiarioService";
import { EmpleadoService } from "../services/EmpleadoService";
import { ApiResponse } from "../dtos/ApiResponse";
import { AuthRequest } from "../middlewares/authMiddleware";
import type {
  RegistroDiarioDetail,
  UpsertRegistroDiarioParams,
} from "../repositories/RegistroDiarioRepository";
import { RegistroDiario } from "@prisma/client";
import {
  RrhhApprovalDto,
  SupervisorApprovalDto,
} from "../dtos/RegistroDiarioApproval.dto";

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * POST /api/registrodiario
 * Crea o actualiza un registro diario + actividades.
 * - Por defecto usa el empleado autenticado.
 * - Opcionalmente acepta ?idEmpleado=123 para actuar en nombre de otro empleado
 *   (requiere rol distinto de 1, según tu validación actual).
 * Valida que `fecha` sea un string ISO date (YYYY-MM-DD).
 */
export const upsertRegistroDiario: RequestHandler<
  {},
  ApiResponse<RegistroDiarioDetail>,
  Omit<UpsertRegistroDiarioParams, "empleadoId" | "horasFeriado">,
  { idEmpleado?: string }
> = async (req, res, next) => {
  try {
    const usuarioId = (req as AuthRequest).user.id;
    const { fecha } = req.body;
    const { idEmpleado } = req.query;

    // Validación sencilla de fecha ISO
    if (
      typeof fecha !== "string" ||
      !ISO_DATE_REGEX.test(fecha) ||
      isNaN(Date.parse(fecha))
    ) {
      return res.status(400).json({
        success: false,
        message: "El campo 'fecha' debe ser un string ISO (YYYY-MM-DD)",
        data: null,
      });
    }

    // Determinar el empleado objetivo del upsert
    let empleadoTargetId: number = usuarioId;

    if (typeof idEmpleado === "string") {
      const parsed = parseInt(idEmpleado, 10);
      if (isNaN(parsed)) {
        return res.status(400).json({
          success: false,
          message: "El query param 'idEmpleado' debe ser un número válido",
          data: null,
        });
      }
      empleadoTargetId = parsed;

      // Si intenta actuar sobre otro empleado, validar permisos por rol
      if (empleadoTargetId !== usuarioId) {
        const empleado = await EmpleadoService.getById(usuarioId);
        // Mantengo tu convención: rolId === 1 no puede actuar sobre terceros
        if (empleado?.rolId === 1) {
          return res.status(403).json({
            success: false,
            message:
              "No tienes permisos para crear/actualizar registros de otros empleados",
            data: null,
          });
        }
      }
    }

    const registro = await RegistroDiarioService.upsertRegistro(
      empleadoTargetId,
      req.body
    );

    return res.status(201).json({
      success: true,
      message: "Registro diario guardado",
      data: registro,
    });
  } catch (err) {
    next(err);
  }
};

export const getRegistroDiarioByDate: RequestHandler<
  {},
  ApiResponse<RegistroDiarioDetail | null>,
  {},
  { fecha?: string; idEmpleado?: string }
> = async (req, res, next) => {
  try {
    const { id: usuarioId } = (req as AuthRequest).user;
    const { fecha, idEmpleado } = req.query;

    // Validar fecha
    if (
      typeof fecha !== "string" ||
      !ISO_DATE_REGEX.test(fecha) ||
      isNaN(Date.parse(fecha))
    ) {
      return res.status(400).json({
        success: false,
        message: "El query param 'fecha' debe ser un string ISO (YYYY-MM-DD)",
        data: null,
      });
    }

    // Determinar qué empleadoId usar
    let empleadoIdNum: number;
    if (idEmpleado !== undefined) {
      empleadoIdNum = parseInt(idEmpleado, 10);
      if (isNaN(empleadoIdNum)) {
        return res.status(400).json({
          success: false,
          message: "El query param 'idEmpleado' debe ser un número válido",
          data: null,
        });
      }

      const empleado = await EmpleadoService.getById(usuarioId);
      // Si intenta ver otro empleado, validar rol
      if (empleadoIdNum !== usuarioId && empleado?.rolId === 1) {
        return res.status(403).json({
          success: false,
          message: "No tienes permisos para ver registros de otros empleados",
          data: null,
        });
      }
    } else {
      empleadoIdNum = usuarioId;
    }

    // Obtener el registro
    const registro = await RegistroDiarioService.getByDate(
      empleadoIdNum,
      fecha
    );

    return res.json({
      success: true,
      message: registro
        ? "Registro encontrado"
        : `No existe registro para la fecha ${fecha}${
            idEmpleado ? ` del empleado ${empleadoIdNum}` : ""
          }`,
      data: registro,
    });
  } catch (err) {
    next(err);
  }
};

export const aprobacionSupervisor: RequestHandler<
  { id: string },
  ApiResponse<RegistroDiario>,
  SupervisorApprovalDto
> = async (req, res, next) => {
  console.log("APROBACION SUPERVISOR");

  try {
    const registroId = parseInt(req.params.id, 10);
    if (isNaN(registroId)) {
      return res
        .status(400)
        .json({ success: false, message: "ID inválido", data: null });
    }

    const updated = await RegistroDiarioService.aprobarSupervisor(
      registroId,
      req.body
    );
    return res.json({
      success: true,
      message: "Aprobación de supervisor actualizada",
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/registrodiario/:id/aprobacion-rrhh
 * Actualiza únicamente la aprobación de RRHH en un registro diario.
 */
export const aprobacionRrhh: RequestHandler<
  { id: string },
  ApiResponse<RegistroDiario>,
  RrhhApprovalDto
> = async (req, res, next) => {
  try {
    const registroId = parseInt(req.params.id, 10);
    if (isNaN(registroId)) {
      return res
        .status(400)
        .json({ success: false, message: "ID inválido", data: null });
    }

    const updated = await RegistroDiarioService.aprobarRrhh(
      registroId,
      req.body
    );
    return res.json({
      success: true,
      message: "Aprobación de RRHH actualizada",
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/registrodiario/update-job-supervisor
 * Permite a un supervisor actualizar el job de una actividad específica
 * de otro empleado. Solo disponible para supervisores (rolId = 2).
 */
export const updateJobBySupervisor: RequestHandler<
  {},
  ApiResponse<RegistroDiarioDetail>,
  { empleadoId: number; actividadId: number; nuevoJobId: number }
> = async (req, res, next) => {
  try {
    const supervisorId = (req as AuthRequest).user.id;
    const { empleadoId, actividadId, nuevoJobId } = req.body;

    // Validaciones básicas
    if (!empleadoId || !actividadId || !nuevoJobId) {
      return res.status(400).json({
        success: false,
        message:
          "Todos los campos son requeridos: empleadoId, actividadId, nuevoJobId",
        data: null,
      });
    }

    if (
      typeof empleadoId !== "number" ||
      typeof actividadId !== "number" ||
      typeof nuevoJobId !== "number"
    ) {
      return res.status(400).json({
        success: false,
        message: "Todos los campos deben ser números",
        data: null,
      });
    }

    const updated = await RegistroDiarioService.updateJobBySupervisor(
      supervisorId,
      empleadoId,
      { actividadId, nuevoJobId }
    );

    return res.json({
      success: true,
      message: "Job de la actividad actualizado correctamente",
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};
