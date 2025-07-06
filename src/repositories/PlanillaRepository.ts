// src/repositories/PlanillaRepository.ts
import { prisma } from "../config/prisma";
import type { Planilla } from "@prisma/client";

export class PlanillaRepository {
  /** Busca planillas del empleado que se traslapan con el rango dado */
  static async findOverlapping(
    empleadoId: number,
    fechaInicio: Date,
    fechaFin: Date
  ): Promise<Planilla[]> {
    return prisma.planilla.findMany({
      where: {
        empleadoId,
        deletedAt: null,
        AND: [
          { fechaInicio: { lte: fechaFin } },
          { fechaFin:    { gte: fechaInicio } },
        ],
      },
    });
  }

  /** Crea una nueva planilla */
  static async createPlanilla(data: {
    empleadoId:  number;
    empresaId:   number;
    fechaInicio: Date;
    fechaFin:    Date;
  }): Promise<Planilla> {
    return prisma.planilla.create({
      data: {
        fechaInicio: data.fechaInicio,
        fechaFin:    data.fechaFin,
        estado:      "A",
        // conecta la relación en vez de usar el scalar empleadoId directo
        empleado: { connect: { id: data.empleadoId } },
        empresa:  { connect: { id: data.empresaId  } },
      },
    });
  }

  /** Listar planillas “planas” de un empleado */
  static async findByEmpleado(
    empleadoId: number
  ): Promise<Planilla[]> {
    return prisma.planilla.findMany({
      where: { empleadoId, deletedAt: null },
      orderBy: { fechaInicio: "desc" },
    });
  }

  /** Devuelve, para cada empleado, la última planilla (rango max fechaInicio) */
  static async findLastByEmpleado(): Promise<Planilla[]> {
    const grouped = await prisma.planilla.groupBy({
      by: ["empleadoId"],
      where: { deletedAt: null },
      _max: { fechaInicio: true },
    });

    const planillas = await Promise.all(
      grouped.map(g =>
        prisma.planilla.findFirst({
          where: {
            empleadoId:  g.empleadoId,
            fechaInicio: g._max.fechaInicio!,
            deletedAt:   null,
          },
        })
      )
    );

    return planillas.filter((p): p is Planilla => p !== null);
  }

  /**
   * Lista todas las planillas de un empleado con sus días,
   * actividades diarias y datos del job (array ordenado por fechaInicio desc).
   */
  static async findByEmpleadoWithDetails(
    empleadoId: number
  ): Promise<Planilla[]> {
    return prisma.planilla.findMany({
      where: { empleadoId, deletedAt: null },
      orderBy: { fechaInicio: "desc" },
      include: {
        planillaDias: {
          where: { deletedAt: null },
          include: {
            actividades: {
              where: { deletedAt: null },
              include: {
                job: {
                  select: {
                    id: true,
                    nombre: true,
                    codigo: true,
                    descripcion: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  /**
   * Obtiene UNA planilla (por id) incluyendo sus días,
   * actividades diarias y datos del job.
   */
  static async findByIdWithDetails(
    planillaId: number
  ): Promise<Planilla | null> {
    return prisma.planilla.findUnique({
      where: { id: planillaId },
      include: {
        planillaDias: {
          where: { deletedAt: null },
          include: {
            actividades: {
              where: { deletedAt: null },
              include: {
                job: {
                  select: {
                    id: true,
                    nombre: true,
                    codigo: true,
                    descripcion: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }
}
