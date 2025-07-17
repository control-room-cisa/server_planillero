// src/repositories/JobRepository.ts
import { prisma } from "../config/prisma";
import type { Job, Prisma } from "@prisma/client";

interface JobFilters {
  activo?: boolean;
  empresaId?: number;
  mostrarEmpresaId?: number;
}

export class JobRepository {
  /** Devuelve todos los jobs (solo los no eliminados) */
  static async findAll(filters: JobFilters = {}): Promise<Job[]> {
    const where: any = { deletedAt: null };

    if (filters.activo !== undefined) where.activo = filters.activo;
    if (filters.empresaId !== undefined) where.empresaId = filters.empresaId;
    if (filters.mostrarEmpresaId !== undefined)
      where.mostrarEmpresaId = filters.mostrarEmpresaId;

    return prisma.job.findMany({
      where,
      include: { empresa: true, empresaMostrar: true },
    });
  }

  /** Devuelve un job por su id */
  static async findById(id: number): Promise<Job | null> {
    return prisma.job.findFirst({
      where: { id, deletedAt: null },
      include: { empresa: true, empresaMostrar: true },
    });
  }

  /** Crea un nuevo job */
  static async create(data: Prisma.JobCreateInput): Promise<Job> {
    return prisma.job.create({ data });
  }

  /** Actualiza un job existente */
  static async update(id: number, data: Prisma.JobUpdateInput): Promise<Job> {
    return prisma.job.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
    });
  }

  /** Soft‐delete: marca deletedAt */
  static async remove(id: number): Promise<Job> {
    return prisma.job.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
