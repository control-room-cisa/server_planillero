// src/controllers/NominaController.ts
import { RequestHandler } from "express";
import { NominaService } from "../services/NominaService";
import { ApiResponse } from "../dtos/ApiResponse";
import { z } from "zod";
import {
  crearNominaSchema,
  actualizarNominaSchema,
} from "../validators/nomina.validator";
import type {
  CrearNominaDto,
  ActualizarNominaDto,
} from "../validators/nomina.validator";
import type { Nomina } from "@prisma/client";
import { AuthRequest } from "../middlewares/authMiddleware";
import { AppError } from "../errors/AppError";

// Helper para normalizar errores a formato estructurado
function normalizeErrors(err: any): { field: string; message: string }[] {
  // Si ya viene como array estructurado
  if (Array.isArray(err?.errors)) {
    return err.errors;
  }

  // Si viene con validationErrors (del dominio de cálculo de horas)
  if (err?.validationErrors) {
    const validationErrors = err.validationErrors;
    const errors: { field: string; message: string }[] = [];

    if (Array.isArray(validationErrors.fechasNoAprobadas)) {
      validationErrors.fechasNoAprobadas.forEach((fecha: string) => {
        errors.push({
          field: "fechasNoAprobadas",
          message: `Fecha no aprobada: ${fecha}`,
        });
      });
    }

    if (Array.isArray(validationErrors.fechasSinRegistro)) {
      validationErrors.fechasSinRegistro.forEach((fecha: string) => {
        errors.push({
          field: "fechasSinRegistro",
          message: `Fecha sin registro: ${fecha}`,
        });
      });
    }

    // Agregar otros campos de validación si existen
    Object.keys(validationErrors).forEach((key) => {
      if (
        key !== "fechasNoAprobadas" &&
        key !== "fechasSinRegistro" &&
        Array.isArray(validationErrors[key])
      ) {
        validationErrors[key].forEach((msg: string) => {
          errors.push({ field: key, message: msg });
        });
      }
    });

    return errors;
  }

  // Si es un mensaje de error simple
  if (typeof err?.message === "string") {
    return [{ field: "general", message: err.message }];
  }

  // Fallback
  return [{ field: "general", message: String(err ?? "Error desconocido") }];
}

// Helper para extraer validationErrors del error
function extractValidationErrors(
  err: any
): ApiResponse<Nomina>["validationErrors"] {
  if (err?.validationErrors) {
    return {
      fechasNoAprobadas: Array.isArray(err.validationErrors.fechasNoAprobadas)
        ? err.validationErrors.fechasNoAprobadas
        : undefined,
      fechasSinRegistro: Array.isArray(err.validationErrors.fechasSinRegistro)
        ? err.validationErrors.fechasSinRegistro
        : undefined,
      ...Object.keys(err.validationErrors).reduce((acc, key) => {
        if (
          key !== "fechasNoAprobadas" &&
          key !== "fechasSinRegistro" &&
          Array.isArray(err.validationErrors[key])
        ) {
          acc[key] = err.validationErrors[key];
        }
        return acc;
      }, {} as Record<string, string[]>),
    };
  }
  return undefined;
}

export const leerNominas: RequestHandler<
  {},
  ApiResponse<Nomina[]>,
  {},
  { empleadoId?: string; empresaId?: string; start?: string; end?: string }
> = async (req, res, next) => {
  try {
    const empleadoId = req.query.empleadoId
      ? Number(req.query.empleadoId)
      : undefined;
    const empresaId = req.query.empresaId
      ? Number(req.query.empresaId)
      : undefined;
    const { start, end } = req.query;

    const data = await NominaService.list({
      empleadoId,
      empresaId,
      start,
      end,
    });
    return res.json({ success: true, message: "Listado de nóminas", data });
  } catch (err) {
    next(err);
  }
};

export const crearNomina: RequestHandler<
  {},
  ApiResponse<Nomina>,
  CrearNominaDto
> = async (req, res, next) => {
  try {
    const payload = crearNominaSchema.parse(req.body);
    const user = (req as AuthRequest).user;
    const created = await NominaService.create(
      {
        ...payload,
      },
      // código del empleado creador, si existe (campo opcional en schema)
      (user as any)?.codigo ?? null
    );
    return res.status(201).json({
      success: true,
      message: "Nómina creada",
      data: created,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      const errors = err.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      return res.status(400).json({
        success: false,
        message: "Error de validación",
        data: null,
        errors,
      });
    }

    // Capturar errores del servicio y devolverlos estructurados
    const errors = normalizeErrors(err);
    const validationErrors = extractValidationErrors(err);

    // Determinar status code según el tipo de error
    const statusCode =
      err instanceof AppError
        ? err.statusCode
        : (err as any)?.statusCode || (err as any)?.status || 500;

    const response: ApiResponse<Nomina> = {
      success: false,
      message: (err as any)?.message || "Error al crear nómina",
      data: null,
      errors: errors.length > 0 ? errors : undefined,
      validationErrors,
    };

    return res.status(statusCode).json(response);
  }
};

export const leerNominaPorId: RequestHandler<
  { id: string },
  ApiResponse<Nomina>,
  {}
> = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res
        .status(400)
        .json({ success: false, message: "id inválido", data: null });
    }
    const data = await NominaService.getById(id);
    return res.json({ success: true, message: "Nómina", data });
  } catch (err) {
    next(err);
  }
};

export const actualizarNomina: RequestHandler<
  { id: string },
  ApiResponse<Nomina>,
  ActualizarNominaDto
> = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const payload = actualizarNominaSchema.parse(req.body);
    const updated = await NominaService.update(id, payload);
    return res.json({
      success: true,
      message: "Nómina actualizada",
      data: updated,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res
        .status(400)
        .json({ success: false, message: "Error de validación", data: null });
    }
    next(err);
  }
};

// Nuevo: listar nóminas (resumen) por empleado
export const leerNominasResumenPorEmpleado: RequestHandler<
  {},
  ApiResponse<
    Array<{
      id: number;
      nombrePeriodoNomina: string;
      fechaInicio: string;
      fechaFin: string;
    }>
  >, // resumen
  {},
  { empleadoId: string }
> = async (req, res, next) => {
  try {
    const empleadoIdStr = req.query.empleadoId;
    if (!empleadoIdStr) {
      return res.status(400).json({
        success: false,
        message: "Error de validación",
        data: null,
        validationErrors: {
          empleadoId: ["empleadoId es requerido"],
        },
      } as any);
    }
    const empleadoId = Number(empleadoIdStr);
    if (!Number.isFinite(empleadoId)) {
      return res.status(400).json({
        success: false,
        message: "Error de validación",
        data: null,
        validationErrors: {
          empleadoId: ["empleadoId inválido"],
        },
      } as any);
    }

    // Reusar servicio existente (suponiendo que tiene list con filtros)
    const nominas = await NominaService.list({ empleadoId });
    const resumen = (nominas || []).map((n: any) => ({
      id: n.id,
      nombrePeriodoNomina: n.nombrePeriodoNomina,
      fechaInicio: n.fechaInicio,
      fechaFin: n.fechaFin,
    }));
    return res.json({
      success: true,
      message: "Listado de nóminas por empleado",
      data: resumen,
    });
  } catch (err: any) {
    // Responder en estándar ApiResponse con mensaje y sin datos, más detalle mínimo
    return res.status(500).json({
      success: false,
      message: err?.message || "Error interno al listar nóminas",
      data: null,
    } as any);
  }
};
