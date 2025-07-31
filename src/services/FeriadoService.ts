// src/services/FeriadoService.ts
import type { Prisma, Feriado } from "@prisma/client";
import { FeriadoRepository } from "../repositories/FeriadoRepository";

export class FeriadoService {
  /** Listar todos los feriados activos (no eliminados) */
  static async listFeriados(): Promise<Feriado[]> {
    return FeriadoRepository.findAll();
  }

  /** Obtener un feriado por fecha (YYYY-MM-DD) */
  static async getFeriadoByDate(fecha: string): Promise<Feriado> {
    const feriado = await FeriadoRepository.findByDate(fecha);
    if (!feriado) {
      throw new Error(`Feriado con fecha ${fecha} no encontrado`);
    }
    return feriado;
  }

  /** Crear nuevo feriado */
  static async createFeriado(
    data: Prisma.FeriadoCreateInput
  ): Promise<Feriado> {
    return FeriadoRepository.create(data);
  }

  /** Actualizar feriado por ID */
  static async updateFeriado(
    id: number,
    data: Prisma.FeriadoUpdateInput
  ): Promise<Feriado> {
    await this.getFeriadoByDate(data.fecha as string); // validar existencia
    return FeriadoRepository.update(id, data);
  }

  /** Eliminar feriado (hard delete) */
  static async deleteFeriado(id: number): Promise<void> {
    await FeriadoRepository.remove(id);
  }
}
