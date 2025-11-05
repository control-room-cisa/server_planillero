// src/services/JobService.ts
import type { Job, Prisma } from "@prisma/client";
import { JobRepository } from "../repositories/JobRepository";
import type { CreateJobDto, UpdateJobDto } from "../validators/job.validator";
import { prisma } from "../config/prisma";

export class JobService {
  /**
   * Validar que el job antecesor exista para códigos jerárquicos
   */
  private static async validateCodigoJerarquico(
    codigo: string,
    mostrarEmpresaId: number,
    excludeId?: number
  ): Promise<void> {
    const partes = codigo.split(".");

    // Si tiene más de un nivel, verificar que el antecesor exista en la misma empresaMostrar
    if (partes.length > 1) {
      const codigoAntecesor = partes.slice(0, -1).join(".");
      const antecesor = await JobRepository.findByCodigoAndEmpresaMostrar(
        codigoAntecesor,
        mostrarEmpresaId
      );

      if (!antecesor) {
        throw new Error(
          `El job antecesor "${codigoAntecesor}" no existe en este grupo`
        );
      }
    }

    // Verificar que no exista un job con el mismo código en la misma empresaMostrar (excepto al editar)
    const jobExistente = await JobRepository.findByCodigoAndEmpresaMostrar(
      codigo,
      mostrarEmpresaId
    );
    if (jobExistente && (!excludeId || jobExistente.id !== excludeId)) {
      throw new Error("Ya existe un job con este código en este grupo");
    }
  }

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
      ...(empresaId !== undefined
        ? { empresa: { connect: { id: empresaId } } }
        : {}),
      ...(mostrarEmpresaId !== undefined
        ? { empresaMostrar: { connect: { id: mostrarEmpresaId } } }
        : {}),
      updatedAt: new Date(),
    };
  }

  static async createJob(data: CreateJobDto): Promise<Job> {
    // Validar código jerárquico antes de crear
    await this.validateCodigoJerarquico(data.codigo, data.mostrarEmpresaId);

    const payload = this.toPrismaCreate(data);
    return JobRepository.create(payload);
  }

  static async updateJob(id: number, data: UpdateJobDto): Promise<Job> {
    const jobExistente = await this.getJobById(id);

    // Validar código jerárquico si se está actualizando el código
    if (data.codigo) {
      const mostrarEmpresaId =
        data.mostrarEmpresaId || jobExistente.mostrarEmpresaId;
      if (!mostrarEmpresaId) {
        throw new Error(
          "No se puede validar el código sin una empresaMostrar válida"
        );
      }
      await this.validateCodigoJerarquico(data.codigo, mostrarEmpresaId, id);
    }

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

  /**
   * Obtiene la empresaId del departamento de un empleado
   * @param empleadoId ID del empleado
   * @returns empresaId del departamento del empleado, o null si no se encuentra
   */
  static async getEmpresaDelDepartamentoPorEmpleado(
    empleadoId: number
  ): Promise<number | null> {
    const empleado = await prisma.empleado.findFirst({
      where: {
        id: empleadoId,
        deletedAt: null,
      },
      select: {
        departamento: {
          select: {
            empresaId: true,
          },
        },
      },
    });

    return empleado?.departamento?.empresaId ?? null;
  }
}
