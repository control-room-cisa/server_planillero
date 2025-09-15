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
  const startDay = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())
  );
  const endDay = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate())
  );

  for (
    let d = new Date(startDay.getTime());
    d.getTime() <= endDay.getTime();
    d = new Date(d.getTime() + 24 * 60 * 60 * 1000)
  ) {
    const lunchStart = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0, 0)
    );
    const lunchEnd = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 13, 0, 0, 0)
    );

    // solape del [start, end] con [lunchStart, lunchEnd]
    const overlapMs = Math.max(
      0,
      Math.min(end.getTime(), lunchEnd.getTime()) -
        Math.max(start.getTime(), lunchStart.getTime())
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
        const end = a.horaFin ? new Date(a.horaFin) : null;

        let duracionRecalc = a.duracionHoras ?? 0;
        if (start && end) {
          const horas = computeHoursWithLunchDiscount(
            start,
            end,
            restOfDia.esHoraCorrida
          );
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

  /**
   * Permite a un supervisor actualizar el job de una actividad específica
   * de otro empleado. Solo disponible para supervisores (rolId = 2).
   */
  static async updateJobBySupervisor(
    supervisorId: number,
    empleadoId: number,
    dto: { actividadId: number; nuevoJobId: number }
  ): Promise<RegistroDiarioDetail> {
    // Verificar que el supervisor tenga rolId = 2
    const supervisor = await prisma.empleado.findFirst({
      where: {
        id: supervisorId,
      },
      select: { rolId: true },
    });

    if (!supervisor || supervisor.rolId !== 2) {
      throw new Error(
        "Solo los supervisores pueden actualizar jobs de otros empleados"
      );
    }

    // Verificar que la actividad pertenezca al empleado especificado
    const actividad = await prisma.actividad.findFirst({
      where: {
        id: dto.actividadId,
        registroDiario: {
          empleadoId: empleadoId,
        },
      },
      include: {
        registroDiario: {
          include: {
            empleado: {
              select: {
                id: true,
                nombre: true,
                apellido: true,
                codigo: true,
              },
            },
            actividades: {
              include: {
                job: {
                  select: {
                    id: true,
                    codigo: true,
                    nombre: true,
                    descripcion: true,
                    empresa: {
                      select: {
                        id: true,
                        nombre: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!actividad) {
      throw new Error(
        "Actividad no encontrada o no pertenece al empleado especificado"
      );
    }

    // Verificar que el nuevo job existe
    const nuevoJob = await prisma.job.findFirst({
      where: {
        id: dto.nuevoJobId,
        deletedAt: null,
      },
      select: { id: true, activo: true },
    });

    if (!nuevoJob || !nuevoJob.activo) {
      throw new Error("Job no encontrado o no está activo");
    }

    // Actualizar el job de la actividad
    await prisma.actividad.update({
      where: { id: dto.actividadId },
      data: {
        jobId: dto.nuevoJobId,
        updatedAt: new Date(),
      },
    });

    // Retornar el registro diario actualizado usando el método existente
    const registroActualizado = await this.findByEmpleadoAndDateWithActivities(
      empleadoId,
      actividad.registroDiario.fecha
    );

    if (!registroActualizado) {
      throw new Error("Error al recuperar el registro actualizado");
    }

    return registroActualizado;
  }

  /**
   * Verifica el estado de aprobación de registros diarios en un rango de fechas
   * y retorna las fechas que no están aprobadas y las fechas sin registro
   */
  static async validateApprovalStatusInRange(
    empleadoId: number,
    fechaInicio: string,
    fechaFin: string
  ): Promise<{
    fechasNoAprobadas: string[];
    fechasSinRegistro: string[];
  }> {
    // Generar todas las fechas en el rango
    const fechasEnRango: string[] = [];
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);
    
    for (let d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1)) {
      fechasEnRango.push(d.toISOString().split('T')[0]);
    }

    // Obtener todos los registros en el rango
    const registros = await prisma.registroDiario.findMany({
      where: {
        empleadoId,
        deletedAt: null,
        fecha: {
          gte: fechaInicio,
          lte: fechaFin,
        },
      },
      select: {
        fecha: true,
        aprobacionSupervisor: true,
      },
    });

    // Crear un map de fechas con registros
    const registrosPorFecha = new Map<string, boolean>();
    registros.forEach(registro => {
      registrosPorFecha.set(registro.fecha, registro.aprobacionSupervisor || false);
    });

    // Clasificar fechas
    const fechasNoAprobadas: string[] = [];
    const fechasSinRegistro: string[] = [];

    fechasEnRango.forEach(fecha => {
      if (!registrosPorFecha.has(fecha)) {
        fechasSinRegistro.push(fecha);
      } else if (!registrosPorFecha.get(fecha)) {
        fechasNoAprobadas.push(fecha);
      }
    });

    return {
      fechasNoAprobadas,
      fechasSinRegistro,
    };
  }
}
