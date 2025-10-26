// src/repositories/NominaRepository.ts
import { prisma } from "../config/prisma";
import type { Prisma, Nomina } from "@prisma/client";

export class NominaRepository {
  static async findById(id: number): Promise<Nomina | null> {
    return prisma.nomina.findFirst({ where: { id, deletedAt: null } });
  }

  static async findMany(params: {
    empleadoId?: number;
    empresaId?: number;
    start?: string;
    end?: string;
  }): Promise<Nomina[]> {
    const { empleadoId, empresaId, start, end } = params;
    return prisma.nomina.findMany({
      where: {
        deletedAt: null,
        empleadoId,
        empresaId,
        ...(start && end
          ? {
              fechaInicio: { gte: new Date(start) },
              fechaFin: { lte: new Date(end) },
            }
          : {}),
      },
      orderBy: { fechaInicio: "desc" },
    });
  }

  static async create(data: Prisma.NominaCreateInput): Promise<Nomina> {
    return prisma.nomina.create({ data });
  }

  static async update(
    id: number,
    data: Prisma.NominaUpdateInput
  ): Promise<Nomina> {
    return prisma.nomina.update({ where: { id }, data });
  }
}
