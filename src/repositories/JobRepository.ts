// src/repositories/JobRepository.ts
import { prisma } from "../config/prisma";
import type { Job, Prisma } from "@prisma/client";

interface JobFilters {
  activo?: boolean;
  empresaId?: number;
  mostrarEmpresaId?: number;
}

export class JobRepository {
  /** Devuelve todos los jobs (solo los no eliminados) + todos los especial=true */
  static async findAll(filters: JobFilters = {}): Promise<Job[]> {
    // Rama base: lo que ya hacías (no eliminados + filtros)
    const baseWhere: Prisma.JobWhereInput = { deletedAt: null };
    if (filters.activo !== undefined) baseWhere.activo = filters.activo;
    if (filters.empresaId !== undefined)
      baseWhere.empresaId = filters.empresaId;
    if (filters.mostrarEmpresaId !== undefined)
      baseWhere.mostrarEmpresaId = filters.mostrarEmpresaId;

    // Rama adicional: incluir SIEMPRE los especial=true (no eliminados),
    // ignorando los demás filtros (activo, empresaId, mostrarEmpresaId).
    const includeEspecial: Prisma.JobWhereInput = {
      especial: true,
      deletedAt: null,
    };

    // OR entre ambas ramas: (baseWhere) OR (especial=true AND not deleted)
    const finalWhere: Prisma.JobWhereInput = {
      OR: [baseWhere, includeEspecial],
    };

    return prisma.job.findMany({
      where: finalWhere,
      include: { empresa: true, empresaMostrar: true },
      orderBy: [
        { empresaId: "asc" },
        // si tus códigos son numéricos como string (e.g. "400.01"), ordena por codigo;
        // si no, usa id:
        { codigo: "asc" },
        { id: "asc" },
      ],
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
