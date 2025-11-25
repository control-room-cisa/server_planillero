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
    codigoNomina?: string;
  }): Promise<Nomina[]> {
    const { empleadoId, empresaId, start, end, codigoNomina } = params;
    return prisma.nomina.findMany({
      where: {
        deletedAt: null,
        empleadoId,
        empresaId,
        ...(codigoNomina ? { codigoNomina } : {}),
        ...(start && end && !codigoNomina
          ? {
              fechaInicio: { gte: new Date(start) },
              fechaFin: { lte: new Date(end) },
            }
          : {}),
      },
      orderBy: { fechaInicio: "desc" },
    });
  }

  /**
   * Busca nóminas que se solapan con el rango de fechas dado para un empleado.
   * Solo considera nóminas no eliminadas (deletedAt IS NULL).
   * Un solapamiento ocurre cuando: (start <= fechaFin) AND (end >= fechaInicio)
   */
  static async findOverlapping(
    empleadoId: number,
    fechaInicio: Date | string,
    fechaFin: Date | string,
    excludeId?: number
  ): Promise<Nomina[]> {
    const inicio =
      fechaInicio instanceof Date ? fechaInicio : new Date(fechaInicio);
    const fin = fechaFin instanceof Date ? fechaFin : new Date(fechaFin);

    return prisma.nomina.findMany({
      where: {
        empleadoId,
        deletedAt: null, // Solo nóminas activas
        ...(excludeId ? { id: { not: excludeId } } : {}),
        // Solapamiento: fechaInicio <= fin AND fechaFin >= inicio
        fechaInicio: { lte: fin },
        fechaFin: { gte: inicio },
      },
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

  static async delete(id: number, deletedBy?: number | null): Promise<Nomina> {
    // Eliminación lógica con auditoría
    return prisma.nomina.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: deletedBy ?? null,
      },
    });
  }
}
