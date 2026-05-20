import { prisma } from "../config/prisma";
import type { AccesoContabilidad, Prisma } from "@prisma/client";

const includeDefault = {
  empleado: {
    select: {
      id: true,
      nombre: true,
      apellido: true,
      codigo: true,
      rolId: true,
    },
  },
  empresa: {
    select: {
      id: true,
      nombre: true,
      codigo: true,
      esConsorcio: true,
    },
  },
  creadoPor: {
    select: {
      id: true,
      nombre: true,
      apellido: true,
      codigo: true,
    },
  },
} satisfies Prisma.AccesoContabilidadInclude;

export type AccesoContabilidadWithRelations = Prisma.AccesoContabilidadGetPayload<{
  include: typeof includeDefault;
}>;

export class AccesoContabilidadRepository {
  static async findAllActive(): Promise<AccesoContabilidadWithRelations[]> {
    return prisma.accesoContabilidad.findMany({
      where: { deletedAt: null },
      include: includeDefault,
      orderBy: [{ empresaId: "asc" }, { empleadoId: "asc" }, { id: "asc" }],
    });
  }

  static async findByIdActive(
    id: number
  ): Promise<AccesoContabilidadWithRelations | null> {
    return prisma.accesoContabilidad.findFirst({
      where: { id, deletedAt: null },
      include: includeDefault,
    });
  }

  /** Par activo (no eliminado), opcionalmente excluyendo un id de fila. */
  static async findActiveByEmpleadoEmpresa(
    empleadoId: number,
    empresaId: number,
    excludeId?: number
  ): Promise<AccesoContabilidad | null> {
    return prisma.accesoContabilidad.findFirst({
      where: {
        empleadoId,
        empresaId,
        deletedAt: null,
        ...(excludeId !== undefined ? { id: { not: excludeId } } : {}),
      },
    });
  }

  static async create(
    data: Prisma.AccesoContabilidadCreateInput
  ): Promise<AccesoContabilidadWithRelations> {
    const row = await prisma.accesoContabilidad.create({
      data,
      include: includeDefault,
    });
    return row;
  }

  static async softDelete(
    id: number,
    updatedBy: number
  ): Promise<AccesoContabilidad> {
    return prisma.accesoContabilidad.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedBy,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Edición con historial: marca la fila anterior como eliminada y crea una nueva.
   */
  static async replaceWithHistory(
    previousId: number,
    payload: { empleadoId: number; empresaId: number },
    editorEmpleadoId: number
  ): Promise<AccesoContabilidadWithRelations> {
    return prisma.$transaction(async (tx) => {
      await tx.accesoContabilidad.update({
        where: { id: previousId },
        data: {
          deletedAt: new Date(),
          updatedBy: editorEmpleadoId,
          updatedAt: new Date(),
        },
      });

      return tx.accesoContabilidad.create({
        data: {
          empleado: { connect: { id: payload.empleadoId } },
          empresa: { connect: { id: payload.empresaId } },
          creadoPor: { connect: { id: editorEmpleadoId } },
        },
        include: includeDefault,
      });
    });
  }
}
