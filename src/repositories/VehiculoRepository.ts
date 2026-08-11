import { prisma } from "../config/prisma";
import type { Vehiculo } from "@prisma/client";

export class VehiculoRepository {
  static async findAll(): Promise<Vehiculo[]> {
    return prisma.vehiculo.findMany({
      where: { deletedAt: null },
      orderBy: { class: "asc" },
    });
  }

  static async findById(id: number): Promise<Vehiculo | null> {
    return prisma.vehiculo.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });
  }

  /** Busca por class incluso soft-deleted (único a nivel de BD). */
  static async findByClass(
    classValue: number,
    excludeId?: number
  ): Promise<Vehiculo | null> {
    return prisma.vehiculo.findFirst({
      where: {
        class: classValue,
        ...(excludeId !== undefined && { id: { not: excludeId } }),
      },
    });
  }

  static async create(data: {
    class: number;
    nombre: string;
    tipo?: string | null;
  }): Promise<Vehiculo> {
    return prisma.vehiculo.create({
      data: {
        class: data.class,
        nombre: data.nombre.trim(),
        tipo: data.tipo?.trim() || null,
      },
    });
  }

  static async update(
    id: number,
    data: { class?: number; nombre?: string; tipo?: string | null }
  ): Promise<Vehiculo> {
    return prisma.vehiculo.update({
      where: { id },
      data: {
        ...(data.class !== undefined && { class: data.class }),
        ...(data.nombre !== undefined && { nombre: data.nombre.trim() }),
        ...(data.tipo !== undefined && {
          tipo: data.tipo?.trim() || null,
        }),
        updatedAt: new Date(),
      },
    });
  }

  static async softDelete(id: number): Promise<Vehiculo> {
    return prisma.vehiculo.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }
}
