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
          { fechaFin: { gte: fechaInicio } },
        ],
      },
    });
  }

  /** Crea una nueva planilla */
  static async createPlanilla(data: {
    empleadoId: number;
    empresaId: number;
    fechaInicio: Date;
    fechaFin: Date;
  }): Promise<Planilla> {
    return prisma.planilla.create({
      data: {
        fechaInicio: data.fechaInicio,
        fechaFin: data.fechaFin,
        estado: "A",
        // conecta la relación en vez de usar el scalar empleadoId directo
        empleado: { connect: { id: data.empleadoId } },
        empresa: { connect: { id: data.empresaId } },
      },
    });
  }

  /** Listar planillas “planas” de un empleado */
  static async findByEmpleado(empleadoId: number): Promise<Planilla[]> {
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
      grouped.map((g) =>
        prisma.planilla.findFirst({
          where: {
            empleadoId: g.empleadoId,
            fechaInicio: g._max.fechaInicio!,
            deletedAt: null,
          },
        })
      )
    );

    return planillas.filter((p): p is Planilla => p !== null);
  }

  static async findByEmpleadoAndDateRange(
    empleadoId: number,
    start: string,
    end: string
  ) {
    return prisma.registroDiario.findMany({
      where: {
        empleadoId,
        fecha: {
          gte: start,
          lte: end,
        },
        deletedAt: null,
      },
      select: {
        id: true,
        fecha: true,
        horaEntrada: true,
        horaSalida: true,
        comentarioEmpleado: true,
        comentarioSupervisor: true,
        actividades: {
          where: { deletedAt: null },
          select: {
            id: true,
            descripcion: true,
            duracionHoras: true,
            job: {
              select: {
                id: true,
                nombre: true,
                descripcion: true,
              },
            },
          },
        },
      },
    });
  }

  static async getEmpleadoBasicData(empleadoId: number) {
    return prisma.empleado.findFirst({
      where: {
        id: empleadoId,
        deletedAt: null,
      },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        codigo: true,
      },
    });
  }
}
