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
  /** Horas feriado provistas por el frontend */
  horasFeriado?: number;
};

/** Detalle con actividades y su job */
export type RegistroDiarioDetail = RegistroDiario & {
  actividades: Array<Actividad & { job: Job }>;
};

/* sin recálculo de horas en backend: se respeta duracionHoras del frontend */

export class RegistroDiarioRepository {
  /**
   * Inserta o actualiza (upsert) un registro diario + actividades.
   * Detecta existencia por fecha (YYYY-MM-DD) y empleado.
   * No recalcula duracionHoras; usa el valor recibido del frontend.
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

    // 2) Preparamos payload de actividades respetando duracionHoras del frontend
    const actPayload =
      actividades?.map((a) => ({
        jobId: a.jobId,
        duracionHoras: a.duracionHoras ?? 0,
        horaInicio: a.horaInicio ?? null,
        horaFin: a.horaFin ?? null,
        esExtra: a.esExtra ?? false,
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
          esHoraCorrida: restOfDia.esHoraCorrida,
          comentarioEmpleado: restOfDia.comentarioEmpleado,
          aprobacionSupervisor: restOfDia.aprobacionSupervisor,
          aprobacionRrhh: restOfDia.aprobacionRrhh,
          codigoSupervisor: restOfDia.codigoSupervisor,
          codigoRrhh: restOfDia.codigoRrhh,
          comentarioSupervisor: restOfDia.comentarioSupervisor,
          comentarioRrhh: restOfDia.comentarioRrhh,
          horasFeriado: restOfDia.horasFeriado,

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
          horasFeriado: restOfDia.horasFeriado,

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

  /**
   * Devuelve aprobación de los últimos N días para un empleado
   */
  static async findApprovalStatusInLastDays(empleadoId: number, days: number) {
    // Calcular rango YYYY-MM-DD de hoy hacia atrás 'days' días
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(today.getDate() - (days - 1));

    const startY = start.getFullYear();
    const startM = String(start.getMonth() + 1).padStart(2, "0");
    const startD = String(start.getDate()).padStart(2, "0");
    const startStr = `${startY}-${startM}-${startD}`;

    return prisma.registroDiario.findMany({
      where: {
        empleadoId,
        fecha: { gte: startStr },
        deletedAt: null,
      },
      select: {
        fecha: true,
        aprobacionSupervisor: true,
        aprobacionRrhh: true,
      },
      orderBy: { fecha: "asc" },
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
   * Actualiza la aprobación de RRHH a true para todos los registros diarios
   * de un empleado en un rango de fechas.
   */
  static async updateRrhhApprovalByDateRange(
    empleadoId: number,
    fechaInicio: string,
    fechaFin: string,
    codigoRrhh?: string
  ): Promise<{ count: number }> {
    return prisma.registroDiario.updateMany({
      where: {
        empleadoId,
        fecha: {
          gte: fechaInicio,
          lte: fechaFin,
        },
        deletedAt: null,
      },
      data: {
        aprobacionRrhh: true,
        codigoRrhh: codigoRrhh ?? null,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Permite a un supervisor actualizar el job y descripción de una actividad específica
   * de otro empleado. Solo disponible para supervisores (rolId = 2).
   */
  static async updateJobBySupervisor(
    supervisorId: number,
    empleadoId: number,
    dto: { actividadId: number; nuevoJobId: number; descripcion?: string }
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

    // Actualizar el job y descripción de la actividad
    await prisma.actividad.update({
      where: { id: dto.actividadId },
      data: {
        jobId: dto.nuevoJobId,
        ...(dto.descripcion !== undefined && { descripcion: dto.descripcion }),
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
      fechasEnRango.push(d.toISOString().split("T")[0]);
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
    registros.forEach((registro) => {
      registrosPorFecha.set(
        registro.fecha,
        registro.aprobacionSupervisor || false
      );
    });

    // Clasificar fechas
    const fechasNoAprobadas: string[] = [];
    const fechasSinRegistro: string[] = [];

    fechasEnRango.forEach((fecha) => {
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
