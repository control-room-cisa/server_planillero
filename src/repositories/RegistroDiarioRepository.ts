// src/repositories/RegistroDiarioRepository.ts
import { prisma } from "../config/prisma";
import type { RegistroDiario, Actividad, Job } from "@prisma/client";

/** DTO reutilizable para cada actividad */
export type ActividadInput = {
  jobId: number;
  duracionHoras: number;
  esExtra?: boolean;
  className?: string;
  descripcion: string;
  horaInicio?: Date;
  horaFin?: Date;
};

/** Parámetros de upsert: datos obligatorios y opcionales */
export type UpsertRegistroDiarioParams = {
  empleadoId: number;
  /** Fecha en formato "YYYY-MM-DD" */
  fecha: string;
  horaEntrada: Date;
  horaSalida: Date;
  jornada?: string;
  esDiaLibre?: boolean;
  esHoraCorrida?: boolean;
  comentarioEmpleado?: string;
  aprobacionSupervisor?: boolean;
  aprobacionRrhh?: boolean;
  codigoSupervisor?: string;
  codigoRrhh?: string;
  comentarioSupervisor?: string;
  comentarioRrhh?: string;
  actividades?: ActividadInput[];
};

/** Detalle con actividades y su job */
export type RegistroDiarioDetail = RegistroDiario & {
  actividades: Array<Actividad & { job: Job }>;
};

/* ========= Helpers para cálculo de horas con almuerzo ========= */

/**
 * Itera por cada día UTC entre start y end y descuenta el solape con 12:00–13:00.
 * Devuelve horas decimales tras el descuento cuando aplica.
 */
function computeHoursWithLunchDiscount(
  start: Date,
  end: Date,
  esHoraCorrida?: boolean
): number {
  // base
  const msBase = end.getTime() - start.getTime();
  if (msBase <= 0) return 0;

  // si es hora corrida, no se descuenta almuerzo
  if (esHoraCorrida) {
    return msBase / 3_600_000;
  }

  // recorrer días que toca el intervalo y sumar solapes con 12:00–13:00 UTC de cada día
  let msDescuentoTotal = 0;

  // normalizar a medianoche UTC de los días de inicio y fin
  const startDay = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const endDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));

  for (
    let d = new Date(startDay.getTime());
    d.getTime() <= endDay.getTime();
    d = new Date(d.getTime() + 24 * 60 * 60 * 1000)
  ) {
    const lunchStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0, 0));
    const lunchEnd   = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 13, 0, 0, 0));

    // solape del [start, end] con [lunchStart, lunchEnd]
    const overlapMs = Math.max(
      0,
      Math.min(end.getTime(), lunchEnd.getTime()) - Math.max(start.getTime(), lunchStart.getTime())
    );

    msDescuentoTotal += overlapMs;
  }

  const msFinal = Math.max(0, msBase - msDescuentoTotal);
  return msFinal / 3_600_000;
}

export class RegistroDiarioRepository {
  /**
   * Inserta o actualiza (upsert) un registro diario + actividades.
   * Detecta existencia por fecha (YYYY-MM-DD) y empleado.
   * Recalcula `duracionHoras` en servidor aplicando descuento de almuerzo
   * (12:00–13:00) sólo cuando NO es hora corrida.
   */
  static async upsertWithActivities(
    params: UpsertRegistroDiarioParams
  ): Promise<RegistroDiarioDetail> {
    const { empleadoId, fecha, actividades, ...restOfDia } = params;

    // 1) Buscamos existente por empleadoId + fecha
    const existente = await prisma.registroDiario.findFirst({
      where: {
        empleadoId,
        deletedAt: null,
        fecha,
      },
    });

    // 2) Preparamos payload de actividades (recalculando duracionHoras aquí)
    const actPayload =
      actividades?.map((a) => {
        const start = a.horaInicio ? new Date(a.horaInicio) : null;
        const end   = a.horaFin ? new Date(a.horaFin) : null;

        let duracionRecalc = a.duracionHoras ?? 0;
        if (start && end) {
          const horas = computeHoursWithLunchDiscount(start, end, restOfDia.esHoraCorrida);
          // Tu columna es Int → redondeamos al entero más cercano
          duracionRecalc = Math.max(0, Math.round(horas));
        }

        return {
          jobId: a.jobId,
          duracionHoras: duracionRecalc,
          horaInicio: a.horaInicio ?? null,
          horaFin: a.horaFin ?? null,
          esExtra: a.esExtra ?? false,
          className: a.className,
          descripcion: a.descripcion,
        };
      }) ?? [];

    if (existente) {
      // 3a) Si existe, borra actividades previas y actualiza el resto
      await prisma.actividad.deleteMany({
        where: { registroDiarioId: existente.id },
      });

      return prisma.registroDiario.update({
        where: { id: existente.id },
        data: {
          // no reasignamos `fecha`
          horaEntrada: restOfDia.horaEntrada,
          horaSalida: restOfDia.horaSalida,
          jornada: restOfDia.jornada,
          esDiaLibre: restOfDia.esDiaLibre,
          esHoraCorrida: restOfDia.esHoraCorrida,
          comentarioEmpleado: restOfDia.comentarioEmpleado,
          aprobacionSupervisor: restOfDia.aprobacionSupervisor,
          aprobacionRrhh: restOfDia.aprobacionRrhh,
          codigoSupervisor: restOfDia.codigoSupervisor,
          codigoRrhh: restOfDia.codigoRrhh,
          comentarioSupervisor: restOfDia.comentarioSupervisor,
          comentarioRrhh: restOfDia.comentarioRrhh,

          actividades: {
            create: actPayload,
          },
        },
        include: {
          actividades: { include: { job: true } },
        },
      });
    } else {
      // 3b) Si no existe, creamos uno nuevo
      return prisma.registroDiario.create({
        data: {
          // ✏️ conecta al empleado existente en vez de usar el escalar directamente
          empleado: {
            connect: { id: empleadoId },
          },
          fecha,
          horaEntrada: restOfDia.horaEntrada,
          horaSalida: restOfDia.horaSalida,
          jornada: restOfDia.jornada,
          esDiaLibre: restOfDia.esDiaLibre,
          esHoraCorrida: restOfDia.esHoraCorrida,
          comentarioEmpleado: restOfDia.comentarioEmpleado,
          aprobacionSupervisor: restOfDia.aprobacionSupervisor,
          aprobacionRrhh: restOfDia.aprobacionRrhh,
          codigoSupervisor: restOfDia.codigoSupervisor,
          codigoRrhh: restOfDia.codigoRrhh,
          comentarioSupervisor: restOfDia.comentarioSupervisor,
          comentarioRrhh: restOfDia.comentarioRrhh,

          actividades: {
            create: actPayload,
          },
        },
        include: {
          actividades: { include: { job: true } },
        },
      });
    }
  }

  /**
   * Busca un registro diario por empleadoId y fecha (YYYY-MM-DD),
   * incluye actividades con su job.
   */
  static async findByEmpleadoAndDateWithActivities(
    empleadoId: number,
    fecha: string
  ): Promise<RegistroDiarioDetail | null> {
    return prisma.registroDiario.findFirst({
      where: {
        empleadoId,
        deletedAt: null,
        fecha: fecha,
      },
      include: {
        actividades: {
          where: { deletedAt: null },
          include: { job: true },
        },
      },
    });
  }

  static async updateSupervisorApproval(
    id: number,
    data: {
      aprobacionSupervisor: boolean;
      codigoSupervisor?: string;
      comentarioSupervisor?: string;
    }
  ): Promise<RegistroDiario> {
    return prisma.registroDiario.update({
      where: { id },
      data: {
        aprobacionSupervisor: data.aprobacionSupervisor,
        codigoSupervisor: data.codigoSupervisor,
        comentarioSupervisor: data.comentarioSupervisor,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Actualiza sólo los campos de aprobación de RRHH en un registro diario.
   */
  static async updateRrhhApproval(
    id: number,
    data: {
      aprobacionRrhh: boolean;
      codigoRrhh?: string;
      comentarioRrhh?: string;
    }
  ): Promise<RegistroDiario> {
    return prisma.registroDiario.update({
      where: { id },
      data: {
        aprobacionRrhh: data.aprobacionRrhh,
        codigoRrhh: data.codigoRrhh,
        comentarioRrhh: data.comentarioRrhh,
        updatedAt: new Date(),
      },
    });
  }
}
