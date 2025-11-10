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
        supervisor: true,
        empleado: true,
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
        supervisor: true,
        empleado: true,
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
        supervisor: true,
        empleado: true,
      },
    });
  }

  /** Crea un nuevo acceso de planilla */
  static async create(
    data: Prisma.PlanillaAccesoCreateInput
  ): Promise<PlanillaAcceso> {
    return prisma.planillaAcceso.create({ data });
  }

  /** Actualiza un acceso de planilla existente */
  static async update(
    id: number,
    data: Prisma.PlanillaAccesoUpdateInput
  ): Promise<PlanillaAcceso> {
    return prisma.planillaAcceso.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
    });
  }

  /** Soft‐delete: marca deletedAt */
  static async remove(id: number): Promise<PlanillaAcceso> {
    return prisma.planillaAcceso.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}




