// src/services/job.service.ts
import type { Job, Prisma } from "@prisma/client";
import { JobRepository } from "../repositories/JobRepository";

export class JobService {
  /**
   * @param filters.activo       undefined = todos, true = sólo activos, false = sólo inactivos
   * @param filters.empresaId
   * @param filters.mostrarEmpresaId
   */
  static async listJobs(filters: {
    activo?: boolean;
    empresaId?: number;
    mostrarEmpresaId?: number;
  }): Promise<Job[]> {
    return JobRepository.findAll(filters);
  }

  /**
   * Obtener un job por su ID; lanza error si no existe o está soft‐deleted
   * @throws Error si no se encuentra el job
   */
  static async getJobById(id: number): Promise<Job> {
    const job = await JobRepository.findById(id);
    if (!job) {
      throw new Error(`Job con id ${id} no encontrado`);
    }
    return job;
  }

  /**
   * Crear un nuevo job; por defecto lo marca como activo si no se indica
   */
  static async createJob(data: Prisma.JobCreateInput): Promise<Job> {
    const payload: Prisma.JobCreateInput = {
      ...data,
      activo: data.activo ?? true,
    };
    return JobRepository.create(payload);
  }

  /**
   * Actualizar un job existente; lanza error si no existe
   */
  static async updateJob(
    id: number,
    data: Prisma.JobUpdateInput
  ): Promise<Job> {
    // Validar existencia
    await this.getJobById(id);
    return JobRepository.update(id, data);
  }

  /**
   * Soft‐delete: marca deletedAt; lanza error si no existe
   */
  static async deleteJob(id: number): Promise<void> {
    // Validar existencia
    await this.getJobById(id);
    await JobRepository.remove(id);
  }
}
