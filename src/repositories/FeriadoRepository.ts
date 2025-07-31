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

  /** Actualiza un feriado existente */
  static async update(
    id: number,
    data: Prisma.FeriadoUpdateInput
  ): Promise<Feriado> {
    return prisma.feriado.update({ where: { id }, data });
  }

  /** Elimina un feriado */
  static async remove(id: number): Promise<Feriado> {
    return prisma.feriado.delete({ where: { id } });
  }
}
