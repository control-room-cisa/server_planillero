// src/services/JobService.ts
import type { Job, Prisma } from "@prisma/client";
import { JobRepository } from "../repositories/JobRepository";
import type { CreateJobDto, UpdateJobDto } from "../validators/job.validator";

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
    if (!job) throw new Error(`Job con id ${id} no encontrado`);
    return job;
  }

  private static toPrismaCreate(data: CreateJobDto): Prisma.JobCreateInput {
    const {
      empresaId,
      mostrarEmpresaId,
      activo,
      especial,
      codigo,
      nombre,
      descripcion,
    } = data;

    return {
      codigo,
      nombre,
      descripcion,
      activo: activo ?? true,
      especial: especial ?? false,
      empresa: { connect: { id: empresaId } },              
      empresaMostrar: { connect: { id: mostrarEmpresaId } },
    };
  }

  private static toPrismaUpdate(data: UpdateJobDto): Prisma.JobUpdateInput {
    const {
      empresaId,
      mostrarEmpresaId,
      activo,
      especial,
      codigo,
      nombre,
      descripcion,
    } = data;

    return {
      ...(codigo !== undefined ? { codigo } : {}),
      ...(nombre !== undefined ? { nombre } : {}),
      ...(descripcion !== undefined ? { descripcion } : {}),
      ...(activo !== undefined ? { activo } : {}),
      ...(especial !== undefined ? { especial } : {}),
      ...(empresaId !== undefined ? { empresa: { connect: { id: empresaId } } } : {}),
      ...(mostrarEmpresaId !== undefined
        ? { empresaMostrar: { connect: { id: mostrarEmpresaId } } }
        : {}),
      updatedAt: new Date(),
    };
  }

  static async createJob(data: CreateJobDto): Promise<Job> {
    const payload = this.toPrismaCreate(data);
    return JobRepository.create(payload);
  }

  static async updateJob(id: number, data: UpdateJobDto): Promise<Job> {
    await this.getJobById(id);
    const payload = this.toPrismaUpdate(data);
    return JobRepository.update(id, payload);
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
