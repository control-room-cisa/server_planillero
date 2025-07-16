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

export class RegistroDiarioRepository {
  /**
   * Inserta o actualiza (upsert) un registro diario + actividades.
   * Detecta existencia por fecha (YYYY-MM-DD) y empleado.
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
        fecha, // ya es "YYYY-MM-DD"
      },
    });

    // 2) Preparamos payload de actividades
    const actPayload =
      actividades?.map((a) => ({
        jobId: a.jobId,
        duracionHoras: a.duracionHoras,
        esExtra: a.esExtra,
        className: a.className,
        descripcion: a.descripcion,
      })) ?? [];

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
