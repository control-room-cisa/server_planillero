// src/controllers/EmpleadoDomainController.ts
import type { RequestHandler } from "express";
import { HorarioTrabajoDomain } from "../domain";
import type { ApiResponse } from "../dtos/ApiResponse";
import type {
  HorarioTrabajo,
  ConteoHorasTrabajadas,
  LineaTiempoDia,
} from "../domain/types";
import { TipoHorario } from "@prisma/client";

// -----------------------------------------------------------------------------
// GET Horario de Trabajo
// -----------------------------------------------------------------------------
export const getHorarioTrabajo: RequestHandler<
  { empleadoId: string; fecha: string }, // params
  ApiResponse<HorarioTrabajo>, // response
  {}, // body
  {} // query
> = async (req, res, next) => {
  try {
    const { empleadoId, fecha } = req.params;

    // Validar parámetros
    if (!empleadoId || !fecha) {
      const resp400: ApiResponse<HorarioTrabajo> = {
        success: false,
        message: "EmpleadoId y fecha son requeridos",
        data: null as any,
      };
      return res.status(400).json(resp400);
    }

    // Validar formato de fecha
    const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!fechaRegex.test(fecha)) {
      const resp400: ApiResponse<HorarioTrabajo> = {
        success: false,
        message: "Formato de fecha inválido. Use YYYY-MM-DD",
        data: null as any,
      };
      return res.status(400).json(resp400);
    }

    const horarioTrabajo =
      await HorarioTrabajoDomain.getHorarioTrabajoByDateAndEmpleado(
        fecha,
        empleadoId
      );

    const resp200: ApiResponse<HorarioTrabajo> = {
      success: true,
      message: "Horario de trabajo obtenido exitosamente",
      data: horarioTrabajo,
    };
    return res.json(resp200);
  } catch (error: any) {
    console.error("Error en getHorarioTrabajo:", error);
    const resp500: ApiResponse<HorarioTrabajo> = {
      success: false,
      message: error.message || "Error interno del servidor",
      data: null as any,
    };
    return res.status(500).json(resp500);
  }
};

// -----------------------------------------------------------------------------
// GET Conteo de Horas
// -----------------------------------------------------------------------------
export const getConteoHoras: RequestHandler<
  { empleadoId: string }, // params
  ApiResponse<ConteoHorasTrabajadas>, // response
  {}, // body
  { fechaInicio?: string; fechaFin?: string } // query
> = async (req, res, next) => {
  try {
    const { empleadoId } = req.params;
    const { fechaInicio, fechaFin } = req.query;

    // Validar parámetros
    if (!empleadoId || !fechaInicio || !fechaFin) {
      const resp400: ApiResponse<ConteoHorasTrabajadas> = {
        success: false,
        message: "EmpleadoId, fechaInicio y fechaFin son requeridos",
        data: null as any,
      };
      return res.status(400).json(resp400);
    }

    // Validar formato de fechas
    const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!fechaRegex.test(fechaInicio) || !fechaRegex.test(fechaFin)) {
      const resp400: ApiResponse<ConteoHorasTrabajadas> = {
        success: false,
        message: "Formato de fecha inválido. Use YYYY-MM-DD",
        data: null as any,
      };
      return res.status(400).json(resp400);
    }

    // Validar que fechaInicio sea menor o igual a fechaFin
    if (new Date(fechaInicio) > new Date(fechaFin)) {
      const resp400: ApiResponse<ConteoHorasTrabajadas> = {
        success: false,
        message: "La fecha de inicio debe ser menor o igual a la fecha de fin",
        data: null as any,
      };
      return res.status(400).json(resp400);
    }

    const conteoHoras =
      await HorarioTrabajoDomain.getConteoHorasTrabajadasByDateAndEmpleado(
        fechaInicio,
        fechaFin,
        empleadoId
      );

    const resp200: ApiResponse<ConteoHorasTrabajadas> = {
      success: true,
      message: "Conteo de horas obtenido exitosamente",
      data: conteoHoras,
    };
    return res.json(resp200);
  } catch (error: any) {
    console.error("Error en getConteoHoras:", error);
    const resp500: ApiResponse<ConteoHorasTrabajadas> = {
      success: false,
      message: error.message || "Error interno del servidor",
      data: null as any,
    };
    return res.status(500).json(resp500);
  }
};
