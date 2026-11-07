// src/controllers/DeduccionAlimentacionController.ts
import type { RequestHandler } from "express";
import { GastosAlimentacionService } from "../services/GastosAlimentacionService";
import type { ApiResponse } from "../dtos/ApiResponse";
import type { AuthRequest } from "../middlewares/authMiddleware";
import { EmpleadoAccessService } from "../services/EmpleadoAccessService";
import { AppError } from "../errors/AppError";
import { ymdGt } from "../utils/dateTime";

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

type ApiError = { field: string; message: string };

function buildOk<T>(message: string, data: T): ApiResponse<T> {
  return { success: true, message, data };
}

function buildErr<T>(
  message: string,
  errors: ApiError[] = [],
  status = 500
): { status: number; body: ApiResponse<T> } {
  const normalized = Array.isArray(errors) ? errors : [];
  return {
    status,
    body: {
      success: false,
      message,
      data: null as any,
      ...(normalized.length ? { errors: normalized } : {}),
    } as any,
  };
}

function normalizeThrownToErrors(err: any): any[] {
  // Prioriza un arreglo ya estructurado
  if (Array.isArray(err?.errors)) return err.errors;
  if (Array.isArray(err?.errores)) return err.errores;

  // Si viene con "detalle/detalles"
  if (err?.detalle) return [err.detalle];
  if (err?.detalles) return [err.detalles];

  // Si el message parece JSON, intenta parsearlo
  if (typeof err?.message === "string") {
    const msg = err.message.trim();
    if (
      (msg.startsWith("{") && msg.endsWith("}")) ||
      (msg.startsWith("[") && msg.endsWith("]"))
    ) {
      try {
        const parsed = JSON.parse(msg);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        /* ignore */
      }
    }
    return [msg];
  }

  return [err?.message || "Error desconocido"];
}

function toApiErrors(items: any[]): ApiError[] {
  const arr = Array.isArray(items) ? items : [];
  return arr
    .map((x) => {
      if (!x) return { field: "general", message: "Error desconocido" };
      if (typeof x === "string") return { field: "general", message: x };
      if (typeof x === "object") {
        const field = typeof x.field === "string" ? x.field : "general";
        const message =
          typeof x.message === "string"
            ? x.message
            : typeof (x as any).mensaje === "string"
            ? (x as any).mensaje
            : typeof (x as any).error === "string"
            ? (x as any).error
            : typeof (x as any).detalle === "string"
            ? (x as any).detalle
            : typeof (x as any).detalles === "string"
            ? (x as any).detalles
            : undefined;
        if (message) return { field, message };
        try {
          return { field, message: JSON.stringify(x) };
        } catch {
          return { field, message: String(x) };
        }
      }
      return { field: "general", message: String(x) };
    })
    .filter(Boolean);
}

/**
 * @route GET /api/deduccion-alimentacion
 * @desc Obtiene las deducciones de alimentaci?n de un empleado por c?digo en un per?odo
 * @query codigoEmpleado - C?digo del empleado
 * @query fechaInicio - Fecha de inicio (YYYY-MM-DD)
 * @query fechaFin - Fecha de fin (YYYY-MM-DD)
 * @access Private
 */
type DetalleConsumo = {
  producto: string;
  precio: number;
  fecha: string;
  categoria: "ALIMENTACION" | "ALOJAMIENTO";
};

type DeduccionAlimentacionData = {
  deduccionesAlimentacion: number;
  deduccionesAlojamiento: number;
  detalle: DetalleConsumo[];
  detalleAlimentacion: DetalleConsumo[];
  detalleAlojamiento: DetalleConsumo[];
  errorAlimentacion?: { tieneError: boolean; mensajeError: string };
};

export const getDeduccionAlimentacion: RequestHandler<
  {}, // params
  ApiResponse<DeduccionAlimentacionData>, // response
  {}, // body
  { codigoEmpleado?: string; fechaInicio?: string; fechaFin?: string } // query
> = async (req, res, next) => {
  const { codigoEmpleado, fechaInicio, fechaFin } = req.query;

  // Validaciones 400
  const errors400: string[] = [];
  if (!codigoEmpleado || codigoEmpleado.trim() === "") {
    errors400.push("codigoEmpleado es requerido.");
  }
  if (!fechaInicio) errors400.push("fechaInicio es requerida.");
  if (!fechaFin) errors400.push("fechaFin es requerida.");
  if (fechaInicio && !FECHA_RE.test(fechaInicio))
    errors400.push('Formato inv?lido para fechaInicio. Use "YYYY-MM-DD".');
  if (fechaFin && !FECHA_RE.test(fechaFin))
    errors400.push('Formato inv?lido para fechaFin. Use "YYYY-MM-DD".');
  if (fechaInicio && fechaFin && ymdGt(String(fechaInicio), String(fechaFin))) {
    errors400.push("fechaInicio debe ser menor o igual a fechaFin.");
  }

  if (errors400.length) {
    const { status, body } = buildErr<DeduccionAlimentacionData>(
      "Par?metros inv?lidos",
      toApiErrors(errors400),
      400
    );
    return res.status(status).json(body);
  }

  try {
    const authReq = req as AuthRequest;
    await EmpleadoAccessService.assertCanViewEmpleadoByCodigo(
      authReq.user,
      String(codigoEmpleado).trim()
    );

    // Llamar al servicio que hace la petici?n a la API externa
    const resultado = await GastosAlimentacionService.obtenerConsumo({
      codigoEmpleado: String(codigoEmpleado).trim(),
      fechaInicio: String(fechaInicio),
      fechaFin: String(fechaFin),
    });

    // Si el servicio devuelve success=false, devolver error
    if (!resultado.success) {
      const { status, body } = buildErr<DeduccionAlimentacionData>(
        resultado.message || "Error al obtener deducciones de alimentaci?n",
        [],
        500
      );
      return res.status(status).json(body);
    }

    const detalle: DetalleConsumo[] = (resultado.items || []).map((item) => ({
      producto: item.producto,
      precio: item.precio || 0,
      fecha: item.fecha,
      categoria: item.categoria,
    }));
    const detalleAlimentacion = detalle.filter(
      (item) => item.categoria === "ALIMENTACION"
    );
    const detalleAlojamiento = detalle.filter(
      (item) => item.categoria === "ALOJAMIENTO"
    );
    const deduccionesAlimentacion = detalleAlimentacion.reduce(
      (total, item) => total + (item.precio || 0),
      0
    );
    const deduccionesAlojamiento = detalleAlojamiento.reduce(
      (total, item) => total + (item.precio || 0),
      0
    );

    // Construir respuesta exitosa
    const data: DeduccionAlimentacionData = {
      deduccionesAlimentacion,
      deduccionesAlojamiento,
      detalle,
      detalleAlimentacion,
      detalleAlojamiento,
      errorAlimentacion: resultado.success
        ? undefined
        : {
            tieneError: true,
            mensajeError: resultado.message || "Error desconocido",
          },
    };

    return res.json(
      buildOk(
        "Deducciones de alimentaci?n obtenidas exitosamente",
        data
      )
    );
  } catch (err: any) {
    if (err instanceof AppError) {
      return next(err);
    }
    const lower = (err?.message ?? "").toLowerCase();
    const status =
      lower.includes("no encontrado") || lower.includes("not found")
        ? 404
        : lower.includes("inv?lid") ||
          lower.includes("invalid") ||
          lower.includes("formato")
        ? 400
        : 500;

    const errors = normalizeThrownToErrors(err);
    const { status: st, body } = buildErr<DeduccionAlimentacionData>(
      err?.message || "Error obteniendo deducciones de alimentaci?n",
      toApiErrors(errors),
      status
    );
    return res.status(st).json(body);
  }
};
