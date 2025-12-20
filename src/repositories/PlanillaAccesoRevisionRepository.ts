// src/repositories/PlanillaAccesoRevisionRepository.ts
import { prisma } from "../config/prisma";
import type { PlanillaAcceso, Prisma } from "@prisma/client";

interface PlanillaAccesoRevisionFilters {
  supervisorId?: number;
  empleadoId?: number;
}

export class PlanillaAccesoRevisionRepository {
  /** Devuelve todos los accesos de planilla (solo los no eliminados) */
  static async findAll(
    filters: PlanillaAccesoRevisionFilters = {}
  ): Promise<PlanillaAcceso[]> {
    const where: Prisma.PlanillaAccesoWhereInput = { deletedAt: null };

    if (filters.supervisorId !== undefined)
      where.supervisorId = filters.supervisorId;
    if (filters.empleadoId !== undefined) where.empleadoId = filters.empleadoId;

    return prisma.planillaAcceso.findMany({
      where,
      include: {
        supervisor: {
          include: {
            departamento: {
              include: {
                empresa: true,
              },
            },
          },
        },
        empleado: {
          include: {
            departamento: {
              include: {
                empresa: true,
              },
            },
          },
        },
      },
      orderBy: [
        { supervisorId: "asc" },
        { empleadoId: "asc" },
        { id: "asc" },
      ],
    });
  }

  /** Devuelve un acceso de planilla por su id */
  static async findById(id: number): Promise<PlanillaAcceso | null> {
    return prisma.planillaAcceso.findFirst({
      where: { id, deletedAt: null },
      include: {
        supervisor: {
          include: {
            departamento: {
              include: {
                empresa: true,
              },
            },
          },
        },
        empleado: {
          include: {
            departamento: {
              include: {
                empresa: true,
              },
            },
          },
        },
      },
    });
  }

  /** Devuelve un acceso de planilla por supervisorId y empleadoId */
  static async findBySupervisorAndEmpleado(
    supervisorId: number,
    empleadoId: number
  ): Promise<PlanillaAcceso | null> {
    return prisma.planillaAcceso.findFirst({
      where: {
        supervisorId,
        empleadoId,
        deletedAt: null,
      },
      include: {
        supervisor: {
          include: {
            departamento: {
              include: {
                empresa: true,
              },
            },
          },
        },
        empleado: {
          include: {
            departamento: {
              include: {
                empresa: true,
              },
            },
          },
        },
      },
    });
  }

  /** Crea un nuevo acceso de planilla */
  static async create(
    data: Prisma.PlanillaAccesoCreateInput
  ): Promise<PlanillaAcceso> {
    const created = await prisma.planillaAcceso.create({ data });
    return this.findById(created.id) as Promise<PlanillaAcceso>;
  }

  /** Actualiza un acceso de planilla existente */
  static async update(
    id: number,
    data: Prisma.PlanillaAccesoUpdateInput
  ): Promise<PlanillaAcceso> {
    await prisma.planillaAcceso.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
    });
    return this.findById(id) as Promise<PlanillaAcceso>;
  }

  /** Soft‐delete: marca deletedAt */
  static async remove(id: number): Promise<PlanillaAcceso> {
    return prisma.planillaAcceso.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}








