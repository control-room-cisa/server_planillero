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
} from "../dtos/RegistroDiarioApprovalDtos";

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * POST /api/registrodiario
 * Crea o actualiza un registro diario + actividades.
 * Valida que `fecha` sea un string ISO date (YYYY-MM-DD).
 */
export const upsertRegistroDiario: RequestHandler<
  {},
  ApiResponse<RegistroDiarioDetail>,
  Omit<UpsertRegistroDiarioParams, "empleadoId">,
  {}
> = async (req, res, next) => {
  try {
    const empleadoId = (req as AuthRequest).user.id;
    const { fecha } = req.body;

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

    const registro = await RegistroDiarioService.upsertRegistro(
      empleadoId,
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
