// src/repositories/RegistroDiarioRepository.ts
import { prisma } from "../config/prisma";
import type { RegistroDiario, Actividad, Job } from "@prisma/client";

/** DTO reutilizable para cada actividad */
export type ActividadInput = {
  jobId:         number;
  duracionHoras: number;
  esExtra?:      boolean;
  className?:    string;
  descripcion:   string;
};

/** Parámetros de upsert: datos obligatorios y opcionales */
export type UpsertRegistroDiarioParams = {
  empleadoId:           number;
  fecha:                Date;
  horaEntrada:          Date;
  horaSalida:           Date;
  jornada?:             string;
  esDiaLibre?:          boolean;
  comentarioEmpleado?:  string;
  aprobacionSupervisor?: string;
  aprobacionRrhh?:      string;
  comentarioSupervisor?: string;
  comentarioRrhh?:      string;
  actividades?:          ActividadInput[];
};

/** El detalle de un registro diario incluyendo job en cada actividad */
export type RegistroDiarioDetail = RegistroDiario & {
  actividades: Array<Actividad & { job: Job }>;
};

export class RegistroDiarioRepository {
  /**
   * Inserta o actualiza (upsert) un registro diario + actividades.
   * Detecta existencia por fecha y empleado.
   */
  static async upsertWithActivities(
    params: UpsertRegistroDiarioParams
  ): Promise<RegistroDiarioDetail> {
    const { empleadoId, fecha, actividades, ...diaDatos } = params;

    // rango de día
    const inicio = new Date(fecha); inicio.setHours(0,0,0,0);
    const fin    = new Date(inicio); fin.setDate(inicio.getDate()+1);

    // busca existente
    const existente = await prisma.registroDiario.findFirst({
      where: {
        empleadoId,
        deletedAt: null,
        horaEntrada: { gte: inicio, lt: fin },
      },
    });

    // prepara payload de actividades
    const actCreate = actividades?.map(a => ({
      jobId:         a.jobId,
      duracionHoras: a.duracionHoras,
      esExtra:       a.esExtra,
      className:     a.className,
      descripcion:   a.descripcion,
    }));

    if (existente) {
      // borra viejas actividades y actualiza
      await prisma.actividad.deleteMany({ where: { registroDiarioId: existente.id } });
      return prisma.registroDiario.update({
        where: { id: existente.id },
        data: {
          ...diaDatos,
          actividades: { create: actCreate },
        },
        include: { actividades: { include: { job: true } } },
      });
    } else {
      // crea nuevo
      return prisma.registroDiario.create({
        data: {
          empleadoId,
          ...diaDatos,
          actividades: { create: actCreate },
        },
        include: { actividades: { include: { job: true } } },
      });
    }
  }

  // src/repositories/RegistroDiarioRepository.ts
  static async findByEmpleadoAndDateWithActivities(
    empleadoId: number,
    fecha:      Date
  ): Promise<RegistroDiarioDetail | null> {
    // Usa los getters UTC para no mezclar local vs UTC
    const y = fecha.getUTCFullYear();
    const m = fecha.getUTCMonth();   // 0 = enero, …, 6 = julio
    const d = fecha.getUTCDate();    // el día “real” de la ISO

    const inicio = new Date(y, m, d, 0, 0, 0, 0);
    const fin    = new Date(y, m, d + 1, 0, 0, 0, 0);

    console.log(
      "rango local:",
      inicio.toISOString(),
      fin.toISOString(),
      "empleado",
      empleadoId
    );

    return prisma.registroDiario.findFirst({
      where: {
        empleadoId,
        deletedAt: null,
        horaEntrada: { gte: inicio, lt: fin },
      },
      include: {
        actividades: {
          where: { deletedAt: null },
          include: { job: true }
        }
      }
    });
  }


}
