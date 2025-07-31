// src/repositories/FeriadoRepository.ts
import { prisma } from "../config/prisma";
import type { Feriado, Prisma } from "@prisma/client";

export class FeriadoRepository {
  /** Devuelve todos los feriados */
  static async findAll(): Promise<Feriado[]> {
    return prisma.feriado.findMany();
  }

  /** Devuelve un feriado por su fecha */
  static async findByDate(fecha: string): Promise<Feriado | null> {
    return prisma.feriado.findUnique({ where: { fecha } });
  }

  /** Crea un nuevo feriado */
  static async create(data: Prisma.FeriadoCreateInput): Promise<Feriado> {
    return prisma.feriado.create({ data });
  }

  static async updateByDate(data: Prisma.FeriadoUpdateInput): Promise<Feriado> {
    const fecha = data.fecha as string;

    if (!fecha) {
      throw new Error("La fecha es requerida para actualizar el feriado");
    }

    return prisma.feriado.update({
      where: { fecha },
      data,
    });
  }

  /** Elimina un feriado */
  static async remove(id: number): Promise<Feriado> {
    return prisma.feriado.delete({ where: { id } });
  }
}
