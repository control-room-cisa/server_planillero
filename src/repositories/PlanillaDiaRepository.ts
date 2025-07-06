import { prisma } from "../config/prisma";
import type {
  Planilla,
  PlanillaDia,
  PlanillaDiaActividad,
  Job
} from "@prisma/client";

export type PlanillaDiaDetail = PlanillaDia & {
  actividades: Array<
    PlanillaDiaActividad & {
      job: Job;
    }
  >;
};

export interface CreateActividadDto {
  jobId:         number;
  duracionHoras: number;
  esExtra?:      boolean;
  className?:    string | null;
  descripcion:   string;
}

export interface UpsertDiaWithActivitiesParams {
  empleadoId:            number;
  registroDate:          Date;
  horaEntrada:           Date;
  horaSalida:            Date;
  jornada?:              string | null;
  esDiaLibre?:           boolean | null;
  comentarioEmpleado?:   string | null;
  aprobacionSupervisor?:  string | null;
  aprobacionRRHH?:        string | null;
  comentarioSupervisor?:  string | null;
  comentarioRRHH?:        string | null;
  actividades?:           CreateActividadDto[];
}

export class PlanillaDiaRepository {
  /**
   * Busca la planilla del empleado que cubra la fecha de registro.
   */
  static async findPlanillaByDate(
    empleadoId: number,
    registroDate: Date
  ): Promise<Planilla | null> {
    return prisma.planilla.findFirst({
      where: {
        empleadoId,
        deletedAt: null,
        fechaInicio: { lte: registroDate },
        fechaFin:    { gte: registroDate },
      },
    });
  }

  /**
   * Crea una nueva planilla con un rango de ~15 días dado.
   */
  static async createPlanilla(data: {
    empleadoId:  number;
    empresaId:   number;
    fechaInicio: Date;
    fechaFin:    Date;
  }): Promise<Planilla> {
    return prisma.planilla.create({
      data: {
        empleadoId:  data.empleadoId,
        empresaId:   data.empresaId,
        fechaInicio: data.fechaInicio,
        fechaFin:    data.fechaFin,
        estado:      "A",
      },
    });
  }

  /**
   * Busca un PlanillaDia por planillaId y día (horaEntrada en ese día).
   */
  static async findDiaByPlanillaAndDate(
    planillaId: number,
    registroDate: Date
  ): Promise<PlanillaDia | null> {
    const startOfDay = new Date(registroDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(registroDate);
    endOfDay.setHours(23, 59, 59, 999);

    return prisma.planillaDia.findFirst({
      where: {
        planillaId,
        deletedAt: null,
        horaEntrada: { gte: startOfDay, lte: endOfDay },
      },
    });
  }

  /**
   * Inserta o actualiza un registro diario + sus actividades.
   *  - Si existe un PlanillaDia para ese día, lo actualiza.
   *  - Si no existe, lo crea.
   * Devuelve siempre el PlanillaDia con sus actividades y job incluido.
   */
  static async upsertDiaWithActivities(
    params: UpsertDiaWithActivitiesParams
  ): Promise<
    PlanillaDia & {
      actividades: Array<
        PlanillaDiaActividad & {
          job: Job
        }
      >
    }
  > {
    // 1) Encuentra (o crea) la planilla correspondiente
    let planilla = await this.findPlanillaByDate(
      params.empleadoId,
      params.registroDate
    );
    if (!planilla) {
      // si no existe, necesitas empresaId del empleado
      const empleado = await prisma.empleado.findFirst({
        where: { id: params.empleadoId, deletedAt: null },
        include: { departamento: true },
      });
      if (!empleado) {
        throw new Error("Empleado no encontrado");
      }
      const empresaId = empleado.departamento.empresaId;

      // calcula el rango de 15 días basado en registroDate
      const day = params.registroDate.getDate();
      const month = params.registroDate.getMonth();
      const year = params.registroDate.getFullYear();

      let inicio: Date, fin: Date;
      if (day >= 12 && day <= 26) {
        inicio = new Date(year, month, 12);
        fin    = new Date(year, month, 26);
      } else if (day >= 27) {
        inicio = new Date(year, month, 27);
        fin    = new Date(year, month + 1, 11);
      } else {
        inicio = new Date(year, month - 1, 27);
        fin    = new Date(year, month, 11);
      }

      planilla = await this.createPlanilla({
        empleadoId:  params.empleadoId,
        empresaId,
        fechaInicio: inicio,
        fechaFin:    fin,
      });
    }

    // 2) Busca si ya hay un día para esa fecha
    const existingDia = await this.findDiaByPlanillaAndDate(
      planilla.id,
      params.registroDate
    );

    // Datos comunes de creación/actualización
    const diaData: any = {
      horaEntrada:         params.horaEntrada,
      horaSalida:          params.horaSalida,
      jornada:             params.jornada,
      esDiaLibre:          params.esDiaLibre,
      comentario:          params.comentarioEmpleado,
      aprobacionSupervisor: params.aprobacionSupervisor,
      aprobacionRrhh:       params.aprobacionRRHH,
      comentarioSupervisor: params.comentarioSupervisor,
      comentarioRrhh:       params.comentarioRRHH,
      planilla:            { connect: { id: planilla.id } },
    };

    // 3) Inserta o actualiza
    if (existingDia) {
      // actualización: borramos las actividades viejas y creamos las nuevas
      await prisma.planillaDiaActividad.deleteMany({
        where: { planillaDiaId: existingDia.id },
      });
      return prisma.planillaDia.update({
        where: { id: existingDia.id },
        data: {
          ...diaData,
          actividades: {
            create: params.actividades?.map(a => ({
              jobId:         a.jobId,
              duracionHoras: a.duracionHoras,
              esExtra:       a.esExtra,
              className:     a.className,
              descripcion:   a.descripcion,
            })),
          },
        },
        include: { actividades: { include: { job: true } } },
      });
    } else {
      // creación
      return prisma.planillaDia.create({
        data: {
          ...diaData,
          actividades: {
            create: params.actividades?.map(a => ({
              jobId:         a.jobId,
              duracionHoras: a.duracionHoras,
              esExtra:       a.esExtra,
              className:     a.className,
              descripcion:   a.descripcion,
            })),
          },
        },
        include: { actividades: { include: { job: true } } },
      });
    }
  }
}
