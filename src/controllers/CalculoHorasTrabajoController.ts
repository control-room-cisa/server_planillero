// src/controllers/CalculoHorasTrabajoController.ts
import type { RequestHandler } from "express";
import { HorarioTrabajoDomain } from "../domain/calculo-horas/horario-trabajo-domain";
import type { ApiResponse } from "../dtos/ApiResponse";
import type {
  HorarioTrabajo,
  ConteoHorasTrabajadas,
  ConteoHorasProrrateo,
} from "../domain/calculo-horas/types";

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

  // Fallback
  return [String(err ?? "Error desconocido")];
}

function toApiErrors(items: any[]): ApiError[] {
  const arr = Array.isArray(items) ? items : [];
  return arr
    .map((x) => {
      if (!x) return { field: "general", message: "Error desconocido" };
      if (typeof x === "string") return { field: "general", message: x };
      if (typeof x === "object") {
        const field = typeof (x as any).field === "string" ? (x as any).field : "general";
        const message =
          typeof (x as any).message === "string"
            ? (x as any).message
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

// -----------------------------------------------------------------------------
// GET /api/horario-trabajo/:empleadoId/:fecha
// -----------------------------------------------------------------------------
export const getHorarioTrabajo: RequestHandler<
  { empleadoId: string; fecha: string }, // params
  ApiResponse<HorarioTrabajo>, // response
  {}, // body
  {} // query
> = async (req, res) => {
  const { empleadoId, fecha } = req.params;

  // Validaciones 400
  const errors400: string[] = [];
  if (!empleadoId) errors400.push("empleadoId es requerido.");
  if (!fecha) errors400.push("fecha es requerida.");
  if (fecha && !FECHA_RE.test(fecha))
    errors400.push('Formato de fecha inválido. Use "YYYY-MM-DD".');

  if (errors400.length) {
    const { status, body } = buildErr<HorarioTrabajo>(
      "Parámetros inválidos",
      toApiErrors(errors400),
      400
    );
    return res.status(status).json(body);
  }

  try {
    const data = await HorarioTrabajoDomain.getHorarioTrabajoByDateAndEmpleado(
      fecha,
      empleadoId
    );
    return res.json(
      buildOk<HorarioTrabajo>("Horario de trabajo obtenido exitosamente", data)
    );
  } catch (err: any) {
    // Heurística para status
    const lower = (err?.message ?? "").toLowerCase();
    const status =
      lower.includes("no encontrado") || lower.includes("not found")
        ? 404
        : lower.includes("inválid") ||
          lower.includes("invalid") ||
          lower.includes("formato")
        ? 400
        : lower.includes("validación") ||
          lower.includes("validation") ||
          lower.includes("cuadre")
        ? 422
        : 500;

    const errors = normalizeThrownToErrors(err);
    const { status: st, body } = buildErr<HorarioTrabajo>(
      err?.message || "Error obteniendo horario de trabajo",
      toApiErrors(errors),
      status
    );
    return res.status(st).json(body);
  }
};

// -----------------------------------------------------------------------------
// GET /api/horario-trabajo/:empleadoId/conteo?fechaInicio=YYYY-MM-DD&fechaFin=YYYY-MM-DD
// -----------------------------------------------------------------------------
export const getConteoHoras: RequestHandler<
  { empleadoId: string }, // params
  ApiResponse<ConteoHorasTrabajadas>, // response
  {}, // body
  { fechaInicio?: string; fechaFin?: string } // query
> = async (req, res) => {
  const { empleadoId } = req.params;
  const { fechaInicio, fechaFin } = req.query;

  // Validaciones 400
  const errors400: string[] = [];
  if (!empleadoId) errors400.push("empleadoId es requerido.");
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
    const { status, body } = buildErr<ConteoHorasTrabajadas>(
      "Parámetros inválidos",
      toApiErrors(errors400),
      400
    );
    return res.status(status).json(body);
  }

  try {
    const data =
      await HorarioTrabajoDomain.getConteoHorasTrabajadasByDateAndEmpleado(
        String(fechaInicio),
        String(fechaFin),
        empleadoId
      );
    return res.json(
      buildOk<ConteoHorasTrabajadas>(
        "Conteo de horas obtenido exitosamente",
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
        : lower.includes("validaciones fallidas") ||
          lower.includes("validación") ||
          lower.includes("cuadre")
        ? 422
        : 500;

    const errors = normalizeThrownToErrors(err);
    const { status: st, body } = buildErr<ConteoHorasTrabajadas>(
      err?.message || "Error obteniendo conteo de horas",
      toApiErrors(errors),
      status
    );
    return res.status(st).json(body);
  }
};

// -----------------------------------------------------------------------------
// GET /api/horario-trabajo/:empleadoId/prorrateo?fechaInicio=YYYY-MM-DD&fechaFin=YYYY-MM-DD
// -----------------------------------------------------------------------------
export const getProrrateo: RequestHandler<
  { empleadoId: string }, // params
  ApiResponse<ConteoHorasProrrateo>, // response
  {}, // body
  { fechaInicio?: string; fechaFin?: string } // query
> = async (req, res) => {
  const { empleadoId } = req.params;
  const { fechaInicio, fechaFin } = req.query;

  // Validaciones 400
  const errors400: string[] = [];
  if (!empleadoId) errors400.push("empleadoId es requerido.");
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
    const { status, body } = buildErr<ConteoHorasProrrateo>(
      "Parámetros inválidos",
      toApiErrors(errors400),
      400
    );
    return res.status(status).json(body);
  }

  try {
    const data =
      await HorarioTrabajoDomain.getProrrateoHorasPorJobByDateAndEmpleado(
        String(fechaInicio),
        String(fechaFin),
        empleadoId
      );
    return res.json(
      buildOk<ConteoHorasProrrateo>(
        "Prorrateo de horas por job obtenido exitosamente",
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
        : lower.includes("validaciones fallidas") ||
          lower.includes("validación") ||
          lower.includes("cuadre")
        ? 422
        : 500;

    const errors = normalizeThrownToErrors(err);
    const { status: st, body } = buildErr<ConteoHorasProrrateo>(
      err?.message || "Error obteniendo prorrateo de horas",
      toApiErrors(errors),
      status
    );
    return res.status(st).json(body);
  }
};

// -----------------------------------------------------------------------------
// GET /api/calculo-horas/:empleadoId/deducciones-alimentacion?fechaInicio=YYYY-MM-DD&fechaFin=YYYY-MM-DD
// -----------------------------------------------------------------------------
export const getDeduccionesAlimentacion: RequestHandler<
  { empleadoId: string }, // params
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
  { fechaInicio?: string; fechaFin?: string } // query
> = async (req, res) => {
  const { empleadoId } = req.params;
  const { fechaInicio, fechaFin } = req.query;

  // Validaciones 400
  const errors400: string[] = [];
  if (!empleadoId) errors400.push("empleadoId es requerido.");
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
    const data = await HorarioTrabajoDomain.getDeduccionesAlimentacion(
      String(fechaInicio),
      String(fechaFin),
      empleadoId
    );
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