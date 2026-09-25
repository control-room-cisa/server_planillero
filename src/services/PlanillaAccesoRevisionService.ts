// src/services/PlanillaAccesoRevisionService.ts
import type { PlanillaAcceso, Prisma } from "@prisma/client";
import { PlanillaAccesoRevisionRepository } from "../repositories/PlanillaAccesoRevisionRepository";
import type {
  CreatePlanillaAccesoRevisionDto,
  UpdatePlanillaAccesoRevisionDto,
} from "../validators/planillaAccesoRevision.validator";
import { prisma } from "../config/prisma";
import { AppError } from "../errors/AppError";
import { Roles } from "../enums/roles";
import { hasAnyRole } from "../utils/roles";

export type PlanillaAccesoActor = {
  id: number;
  rolIds: number[];
};

export class PlanillaAccesoRevisionService {
  /** RRHH gestiona todos; supervisor solo los suyos. */
  private static isRrhh(actor: PlanillaAccesoActor): boolean {
    return hasAnyRole(actor.rolIds, Roles.RRHH);
  }

  private static assertSupervisorOwns(
    actor: PlanillaAccesoActor,
    supervisorId: number
  ): void {
    if (this.isRrhh(actor)) return;
    if (supervisorId !== actor.id) {
      throw new AppError(
        "No tienes permiso para gestionar accesos de planilla de otro supervisor",
        403
      );
    }
  }

  /**
   * @param filters.supervisorId
   * @param filters.empleadoId
   * @param actor — si es supervisor (sin RRHH), fuerza filtro a sus propios accesos
   */
  static async listPlanillaAccesoRevision(
    filters: {
      supervisorId?: number;
      empleadoId?: number;
    },
    actor: PlanillaAccesoActor
  ): Promise<PlanillaAcceso[]> {
    let supervisorId = filters.supervisorId;

    if (!this.isRrhh(actor)) {
      // Supervisor: solo sus vínculos; ignora/override query ajena
      if (supervisorId != null && supervisorId !== actor.id) {
        throw new AppError(
          "No tienes permiso para listar accesos de otro supervisor",
          403
        );
      }
      supervisorId = actor.id;
    }

    return PlanillaAccesoRevisionRepository.findAll({
      supervisorId,
      empleadoId: filters.empleadoId,
    });
  }

  /**
   * Obtener un acceso de planilla por su ID
   */
  static async getPlanillaAccesoRevisionById(
    id: number,
    actor?: PlanillaAccesoActor
  ): Promise<PlanillaAcceso> {
    const acceso = await PlanillaAccesoRevisionRepository.findById(id);
    if (!acceso) {
      throw new AppError(`PlanillaAccesoRevision con id ${id} no encontrado`, 404);
    }
    if (actor) {
      this.assertSupervisorOwns(actor, acceso.supervisorId);
    }
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
      throw new AppError(`Supervisor con id ${supervisorId} no encontrado`, 404);
    }

    const empleado = await prisma.empleado.findFirst({
      where: {
        id: empleadoId,
        deletedAt: null,
      },
    });

    if (!empleado) {
      throw new AppError(`Empleado con id ${empleadoId} no encontrado`, 404);
    }

    if (supervisorId === empleadoId) {
      throw new AppError(
        "El supervisor y el empleado no pueden ser la misma persona",
        400
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
      throw new AppError(
        "Ya existe un acceso de planilla para este supervisor y empleado",
        409
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
    data: CreatePlanillaAccesoRevisionDto,
    actor: PlanillaAccesoActor
  ): Promise<PlanillaAcceso> {
    const payloadData = { ...data };

    if (!this.isRrhh(actor)) {
      // Supervisor solo puede crear vínculos donde él es el supervisor
      if (
        payloadData.supervisorId != null &&
        payloadData.supervisorId !== actor.id
      ) {
        throw new AppError(
          "No tienes permiso para crear accesos de planilla para otro supervisor",
          403
        );
      }
      payloadData.supervisorId = actor.id;
    }

    await this.validateSupervisorAndEmpleado(
      payloadData.supervisorId,
      payloadData.empleadoId
    );
    await this.validateUniqueAccess(
      payloadData.supervisorId,
      payloadData.empleadoId
    );

    const payload = this.toPrismaCreate(payloadData);
    return PlanillaAccesoRevisionRepository.create(payload);
  }

  static async updatePlanillaAccesoRevision(
    id: number,
    data: UpdatePlanillaAccesoRevisionDto,
    actor: PlanillaAccesoActor
  ): Promise<PlanillaAcceso> {
    const accesoExistente = await this.getPlanillaAccesoRevisionById(id, actor);

    const supervisorId =
      data.supervisorId !== undefined
        ? data.supervisorId
        : accesoExistente.supervisorId;
    const empleadoId =
      data.empleadoId !== undefined
        ? data.empleadoId
        : accesoExistente.empleadoId;

    if (!this.isRrhh(actor)) {
      // No puede reasignar el vínculo a otro supervisor
      if (supervisorId !== actor.id) {
        throw new AppError(
          "No tienes permiso para asignar el acceso a otro supervisor",
          403
        );
      }
    }

    await this.validateSupervisorAndEmpleado(supervisorId, empleadoId);
    await this.validateUniqueAccess(supervisorId, empleadoId, id);

    const payload = this.toPrismaUpdate(data);
    return PlanillaAccesoRevisionRepository.update(id, payload);
  }

  /**
   * Soft‐delete: marca deletedAt
   */
  static async deletePlanillaAccesoRevision(
    id: number,
    actor: PlanillaAccesoActor
  ): Promise<void> {
    await this.getPlanillaAccesoRevisionById(id, actor);
    await PlanillaAccesoRevisionRepository.remove(id);
  }
}
