// src/services/PlanillaAccesoRevisionService.ts
import type { PlanillaAcceso, Prisma } from "@prisma/client";
import { PlanillaAccesoRevisionRepository } from "../repositories/PlanillaAccesoRevisionRepository";
import type {
  CreatePlanillaAccesoRevisionDto,
  UpdatePlanillaAccesoRevisionDto,
} from "../validators/planillaAccesoRevision.validator";
import { prisma } from "../config/prisma";

export class PlanillaAccesoRevisionService {
  /**
   * @param filters.supervisorId
   * @param filters.empleadoId
   */
  static async listPlanillaAccesoRevision(filters: {
    supervisorId?: number;
    empleadoId?: number;
  }): Promise<PlanillaAcceso[]> {
    return PlanillaAccesoRevisionRepository.findAll(filters);
  }

  /**
   * Obtener un acceso de planilla por su ID; lanza error si no existe o está soft‐deleted
   * @throws Error si no se encuentra el acceso
   */
  static async getPlanillaAccesoRevisionById(
    id: number
  ): Promise<PlanillaAcceso> {
    const acceso = await PlanillaAccesoRevisionRepository.findById(id);
    if (!acceso)
      throw new Error(`PlanillaAccesoRevision con id ${id} no encontrado`);
    return acceso;
  }

  /**
   * Valida que el supervisor y empleado existan y no estén eliminados
   */
  private static async validateSupervisorAndEmpleado(
    supervisorId: number,
    empleadoId: number
  ): Promise<void> {
    const supervisor = await prisma.empleado.findFirst({
      where: {
        id: supervisorId,
        deletedAt: null,
      },
    });

    if (!supervisor) {
      throw new Error(`Supervisor con id ${supervisorId} no encontrado`);
    }

    const empleado = await prisma.empleado.findFirst({
      where: {
        id: empleadoId,
        deletedAt: null,
      },
    });

    if (!empleado) {
      throw new Error(`Empleado con id ${empleadoId} no encontrado`);
    }

    // Validar que no sean el mismo empleado
    if (supervisorId === empleadoId) {
      throw new Error(
        "El supervisor y el empleado no pueden ser la misma persona"
      );
    }
  }

  /**
   * Valida que no exista ya un acceso con el mismo supervisor y empleado
   */
  private static async validateUniqueAccess(
    supervisorId: number,
    empleadoId: number,
    excludeId?: number
  ): Promise<void> {
    const accesoExistente =
      await PlanillaAccesoRevisionRepository.findBySupervisorAndEmpleado(
        supervisorId,
        empleadoId
      );

    if (accesoExistente && (!excludeId || accesoExistente.id !== excludeId)) {
      throw new Error(
        "Ya existe un acceso de planilla para este supervisor y empleado"
      );
    }
  }

  private static toPrismaCreate(
    data: CreatePlanillaAccesoRevisionDto
  ): Prisma.PlanillaAccesoCreateInput {
    const { supervisorId, empleadoId } = data;

    return {
      supervisor: { connect: { id: supervisorId } },
      empleado: { connect: { id: empleadoId } },
    };
  }

  private static toPrismaUpdate(
    data: UpdatePlanillaAccesoRevisionDto
  ): Prisma.PlanillaAccesoUpdateInput {
    const { supervisorId, empleadoId } = data;

    return {
      ...(supervisorId !== undefined
        ? { supervisor: { connect: { id: supervisorId } } }
        : {}),
      ...(empleadoId !== undefined
        ? { empleado: { connect: { id: empleadoId } } }
        : {}),
      updatedAt: new Date(),
    };
  }

  static async createPlanillaAccesoRevision(
    data: CreatePlanillaAccesoRevisionDto
  ): Promise<PlanillaAcceso> {
    // Validar que supervisor y empleado existan
    await this.validateSupervisorAndEmpleado(
      data.supervisorId,
      data.empleadoId
    );

    // Validar que no exista ya un acceso con el mismo supervisor y empleado
    await this.validateUniqueAccess(data.supervisorId, data.empleadoId);

    const payload = this.toPrismaCreate(data);
    return PlanillaAccesoRevisionRepository.create(payload);
  }

  static async updatePlanillaAccesoRevision(
    id: number,
    data: UpdatePlanillaAccesoRevisionDto
  ): Promise<PlanillaAcceso> {
    const accesoExistente = await this.getPlanillaAccesoRevisionById(id);

    // Si se está actualizando supervisorId o empleadoId, validar
    const supervisorId =
      data.supervisorId !== undefined
        ? data.supervisorId
        : accesoExistente.supervisorId;
    const empleadoId =
      data.empleadoId !== undefined
        ? data.empleadoId
        : accesoExistente.empleadoId;

    // Validar que supervisor y empleado existan
    await this.validateSupervisorAndEmpleado(supervisorId, empleadoId);

    // Validar que no exista ya un acceso con el mismo supervisor y empleado (excepto el actual)
    await this.validateUniqueAccess(supervisorId, empleadoId, id);

    const payload = this.toPrismaUpdate(data);
    return PlanillaAccesoRevisionRepository.update(id, payload);
  }

  /**
   * Soft‐delete: marca deletedAt; lanza error si no existe
   */
  static async deletePlanillaAccesoRevision(id: number): Promise<void> {
    // Validar existencia
    await this.getPlanillaAccesoRevisionById(id);
    await PlanillaAccesoRevisionRepository.remove(id);
  }
}






