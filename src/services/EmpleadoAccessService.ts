import { prisma } from "../config/prisma";
import { Roles } from "../enums/roles";
import { hasAnyRole } from "../utils/roles";
import { AppError } from "../errors/AppError";
import { PlanillaAccesoRevisionRepository } from "../repositories/PlanillaAccesoRevisionRepository";
import { AccesoContabilidadService } from "./AccesoContabilidadService";

export type ViewerContext = {
  id: number;
  departamentoId: number;
  rolIds: number[];
};

/**
 * Autorización de lectura de datos de colaborador (detalle, horas, deducciones).
 * - Propio usuario
 * - RRHH / GERENCIA / SUPERVISOR_CONTABILIDAD: cualquier colaborador
 * - SUPERVISOR: mismo departamento o PlanillaAcceso
 * - ASISTENTE_CONTABILIDAD: vía accesos_contabilidad (empresa)
 */
export class EmpleadoAccessService {
  static async assertSupervisorCanAccessEmpleado(
    supervisorId: number,
    supervisorDepartamentoId: number,
    empleadoId: number
  ): Promise<void> {
    const empleado = await prisma.empleado.findFirst({
      where: { id: empleadoId, deletedAt: null },
      select: { id: true, departamentoId: true },
    });

    if (!empleado) {
      throw new AppError("Empleado no encontrado", 404);
    }

    if (empleado.departamentoId === supervisorDepartamentoId) {
      return;
    }

    const acceso =
      await PlanillaAccesoRevisionRepository.findBySupervisorAndEmpleado(
        supervisorId,
        empleadoId
      );

    if (acceso) {
      return;
    }

    throw new AppError(
      "No tienes permiso para gestionar registros de este empleado",
      403
    );
  }

  static async assertCanViewEmpleado(
    viewer: ViewerContext,
    targetEmpleadoId: number
  ): Promise<void> {
    if (!Number.isFinite(targetEmpleadoId) || targetEmpleadoId <= 0) {
      throw new AppError("Identificador de colaborador inválido", 400);
    }

    if (viewer.id === targetEmpleadoId) {
      return;
    }

    if (
      hasAnyRole(
        viewer.rolIds,
        Roles.RRHH,
        Roles.GERENCIA,
        Roles.SUPERVISOR_CONTABILIDAD
      )
    ) {
      const exists = await prisma.empleado.findFirst({
        where: { id: targetEmpleadoId, deletedAt: null },
        select: { id: true },
      });
      if (!exists) {
        throw new AppError("Empleado no encontrado", 404);
      }
      return;
    }

    if (hasAnyRole(viewer.rolIds, Roles.SUPERVISOR)) {
      await this.assertSupervisorCanAccessEmpleado(
        viewer.id,
        viewer.departamentoId,
        targetEmpleadoId
      );
      return;
    }

    if (hasAnyRole(viewer.rolIds, Roles.ASISTENTE_CONTABILIDAD)) {
      await AccesoContabilidadService.assertViewerCanAccessProrrateoEmpleado(
        viewer.id,
        viewer.rolIds,
        targetEmpleadoId
      );
      return;
    }

    throw new AppError(
      "No tienes permiso para ver datos de este colaborador",
      403
    );
  }

  static async assertCanViewEmpleadoByCodigo(
    viewer: ViewerContext,
    codigo: string
  ): Promise<number> {
    const empleado = await prisma.empleado.findFirst({
      where: { codigo: codigo.trim(), deletedAt: null },
      select: { id: true },
    });
    if (!empleado) {
      throw new AppError("Colaborador no encontrado", 404);
    }
    await this.assertCanViewEmpleado(viewer, empleado.id);
    return empleado.id;
  }
}
