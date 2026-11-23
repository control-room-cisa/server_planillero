import { prisma } from "../../config/prisma";
import { ymdToPrismaDate } from "../../utils/dateTime";

export type HistorialSalarioRow = {
  id: number;
  empleadoId: number;
  sueldoMensual: number;
  fechaVigencia: Date;
  createdAt: Date | null;
  createdById: number | null;
};

function toYmd(d: Date | string): string {
  if (typeof d === "string") return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function todayYmd(): string {
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, "0");
  const day = String(n.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Resolución pura: última fila con fechaVigencia <= fechaRef. */
export function resolverSueldoDesdeFilas(
  filas: Array<{ sueldoMensual: number; fechaVigencia: string }>,
  fechaRef: string,
  fallback = 0,
): number {
  const ref = toYmd(fechaRef);
  let bestSueldo: number | null = null;
  let bestVigencia = "";
  let bestOrd = -1;
  for (let ord = 0; ord < filas.length; ord++) {
    const f = filas[ord];
    const v = toYmd(f.fechaVigencia);
    if (v > ref) continue;
    if (
      bestSueldo === null ||
      v > bestVigencia ||
      (v === bestVigencia && ord > bestOrd)
    ) {
      bestSueldo = Number(f.sueldoMensual);
      bestVigencia = v;
      bestOrd = ord;
    }
  }
  return bestSueldo !== null ? bestSueldo : fallback;
}

/**
 * Último sueldo con fechaVigencia <= fechaRef.
 * Fallback: Empleado.sueldoMensual (o 0).
 */
export async function resolverSueldoVigente(
  empleadoId: number,
  fechaRef: string,
): Promise<number> {
  const ref = ymdToPrismaDate(toYmd(fechaRef));
  const row = await prisma.historialSalario.findFirst({
    where: {
      empleadoId,
      fechaVigencia: { lte: ref },
    },
    orderBy: [{ fechaVigencia: "desc" }, { id: "desc" }],
  });
  if (row) return Number(row.sueldoMensual ?? 0);

  const emp = await prisma.empleado.findFirst({
    where: { id: empleadoId, deletedAt: null },
    select: { sueldoMensual: true },
  });
  return Number(emp?.sueldoMensual ?? 0);
}

/** Actualiza Empleado.sueldoMensual al vigente de hoy. */
export async function sincronizarSueldoActual(
  empleadoId: number,
): Promise<number> {
  const vigente = await resolverSueldoVigente(empleadoId, todayYmd());
  await prisma.empleado.update({
    where: { id: empleadoId },
    data: { sueldoMensual: vigente, updatedAt: new Date() },
  });
  return vigente;
}

export async function listHistorialSalarios(
  empleadoId: number,
): Promise<HistorialSalarioRow[]> {
  const rows = await prisma.historialSalario.findMany({
    where: { empleadoId },
    orderBy: [{ fechaVigencia: "desc" }, { id: "desc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    empleadoId: r.empleadoId,
    sueldoMensual: Number(r.sueldoMensual),
    fechaVigencia: r.fechaVigencia,
    createdAt: r.createdAt,
    createdById: r.createdById,
  }));
}

/**
 * Inserta historial si no existe el mismo monto+vigencia.
 * Luego sincroniza sueldo actual del empleado.
 */
export async function registrarAjusteSalario(params: {
  empleadoId: number;
  sueldoMensual: number;
  fechaVigencia: string;
  createdById?: number | null;
}): Promise<HistorialSalarioRow> {
  const fecha = ymdToPrismaDate(toYmd(params.fechaVigencia));
  const sueldo = Number(params.sueldoMensual);

  const existing = await prisma.historialSalario.findFirst({
    where: {
      empleadoId: params.empleadoId,
      fechaVigencia: fecha,
      sueldoMensual: sueldo,
    },
  });
  if (existing) {
    await sincronizarSueldoActual(params.empleadoId);
    return {
      id: existing.id,
      empleadoId: existing.empleadoId,
      sueldoMensual: Number(existing.sueldoMensual),
      fechaVigencia: existing.fechaVigencia,
      createdAt: existing.createdAt,
      createdById: existing.createdById,
    };
  }

  const created = await prisma.historialSalario.create({
    data: {
      empleadoId: params.empleadoId,
      sueldoMensual: sueldo,
      fechaVigencia: fecha,
      createdById: params.createdById ?? null,
    },
  });
  await sincronizarSueldoActual(params.empleadoId);
  return {
    id: created.id,
    empleadoId: created.empleadoId,
    sueldoMensual: Number(created.sueldoMensual),
    fechaVigencia: created.fechaVigencia,
    createdAt: created.createdAt,
    createdById: created.createdById,
  };
}
