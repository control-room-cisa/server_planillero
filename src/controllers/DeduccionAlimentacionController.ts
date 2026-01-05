// src/controllers/DeduccionAlimentacionController.ts
import type { RequestHandler } from "express";
import { GastosAlimentacionService } from "../services/GastosAlimentacionService";
import type { ApiResponse } from "../dtos/ApiResponse";

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
 * @desc Obtiene las deducciones de alimentación de un empleado por código en un período
 * @query codigoEmpleado - Código del empleado
 * @query fechaInicio - Fecha de inicio (YYYY-MM-DD)
 * @query fechaFin - Fecha de fin (YYYY-MM-DD)
 * @access Private
 */
export const getDeduccionAlimentacion: RequestHandler<
  {}, // params
  ApiResponse<{
    deduccionesAlimentacion: number;
    detalle: Array<{
      producto: string;
      precio: number;
      fecha: string;
    }>;
    errorAlimentacion?: { tieneError: boolean; mensajeError: string };
  }>, // response
  {}, // body
  { codigoEmpleado?: string; fechaInicio?: string; fechaFin?: string } // query
> = async (req, res) => {
  const { codigoEmpleado, fechaInicio, fechaFin } = req.query;

  // Validaciones 400
  const errors400: string[] = [];
  if (!codigoEmpleado || codigoEmpleado.trim() === "") {
    errors400.push("codigoEmpleado es requerido.");
  }
  if (!fechaInicio) errors400.push("fechaInicio es requerida.");
  if (!fechaFin) errors400.push("fechaFin es requerida.");
  if (fechaInicio && !FECHA_RE.test(fechaInicio))
    errors400.push('Formato inválido para fechaInicio. Use "YYYY-MM-DD".');
  if (fechaFin && !FECHA_RE.test(fechaFin))
    errors400.push('Formato inválido para fechaFin. Use "YYYY-MM-DD".');
  if (fechaInicio && fechaFin && new Date(fechaInicio) > new Date(fechaFin)) {
    errors400.push("fechaInicio debe ser menor o igual a fechaFin.");
  }

  if (errors400.length) {
    const { status, body } = buildErr<{
      deduccionesAlimentacion: number;
      detalle: Array<{
        producto: string;
        precio: number;
        fecha: string;
      }>;
      errorAlimentacion?: { tieneError: boolean; mensajeError: string };
    }>("Parámetros inválidos", toApiErrors(errors400), 400);
    return res.status(status).json(body);
  }

  try {
    // Llamar al servicio que hace la petición a la API externa
    const resultado = await GastosAlimentacionService.obtenerConsumo({
      codigoEmpleado: String(codigoEmpleado).trim(),
      fechaInicio: String(fechaInicio),
      fechaFin: String(fechaFin),
    });

    // Si el servicio devuelve success=false, devolver error
    if (!resultado.success) {
      const { status, body } = buildErr<{
        deduccionesAlimentacion: number;
        detalle: Array<{
          producto: string;
          precio: number;
          fecha: string;
        }>;
        errorAlimentacion?: { tieneError: boolean; mensajeError: string };
      }>(
        resultado.message || "Error al obtener deducciones de alimentación",
        [],
        500
      );
      return res.status(status).json(body);
    }

    // Calcular el total de deducciones
    const deduccionesAlimentacion = (resultado.items || []).reduce(
      (total, item) => total + (item.precio || 0),
      0
    );

    // Construir respuesta exitosa
    const data = {
      deduccionesAlimentacion,
      detalle: resultado.items || [],
      errorAlimentacion: resultado.success
        ? undefined
        : {
            tieneError: true,
            mensajeError: resultado.message || "Error desconocido",
          },
    };

    return res.json(
      buildOk<typeof data>(
        "Deducciones de alimentación obtenidas exitosamente",
        data
      )
    );
  } catch (err: any) {
    const lower = (err?.message ?? "").toLowerCase();
    const status =
      lower.includes("no encontrado") || lower.includes("not found")
        ? 404
        : lower.includes("inválid") ||
          lower.includes("invalid") ||
          lower.includes("formato")
        ? 400
        : 500;

    const errors = normalizeThrownToErrors(err);
    const { status: st, body } = buildErr<{
      deduccionesAlimentacion: number;
      detalle: Array<{
        producto: string;
        precio: number;
        fecha: string;
      }>;
      errorAlimentacion?: { tieneError: boolean; mensajeError: string };
    }>(
      err?.message || "Error obteniendo deducciones de alimentación",
      toApiErrors(errors),
      status
    );
    return res.status(st).json(body);
  }
};
