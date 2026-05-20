import { prisma } from "../config/prisma";
import { Roles } from "../enums/roles";
import { AppError } from "../errors/AppError";
import {
  AccesoContabilidadRepository,
  type AccesoContabilidadWithRelations,
} from "../repositories/AccesoContabilidadRepository";
import type {
  CreateAccesoContabilidadDto,
  UpdateAccesoContabilidadDto,
} from "../validators/accesoContabilidad.validator";

export class AccesoContabilidadService {
  static async listActive(): Promise<AccesoContabilidadWithRelations[]> {
    return AccesoContabilidadRepository.findAllActive();
  }

  static async getByIdActive(id: number): Promise<AccesoContabilidadWithRelations> {
    const row = await AccesoContabilidadRepository.findByIdActive(id);
    if (!row) {
      throw new AppError("Acceso no encontrado o eliminado", 404);
    }
    return row;
  }

  /** Empleados con rol asistente de contabilidad (activos, no eliminados). */
  static async listEmpleadosAsistentes() {
    return prisma.empleado.findMany({
      where: {
        deletedAt: null,
        activo: true,
        rolId: Roles.ASISTENTE_CONTABILIDAD,
      },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        codigo: true,
        departamento: {
          select: {
            nombre: true,
            empresa: { select: { id: true, nombre: true } },
          },
        },
      },
      orderBy: [{ nombre: "asc" }, { apellido: "asc" }],
    });
  }

  /** Empresas marcadas como consorcio (esConsorcio / visible = true). */
  static async listEmpresasConsorcio() {
    return prisma.empresa.findMany({
      where: {
        deletedAt: null,
        esConsorcio: true,
      },
      select: {
        id: true,
        nombre: true,
        codigo: true,
        esConsorcio: true,
      },
      orderBy: { nombre: "asc" },
    });
  }

  static async getCatalogos() {
    const [empleados, empresas] = await Promise.all([
      this.listEmpleadosAsistentes(),
      this.listEmpresasConsorcio(),
    ]);
    return { empleados, empresas };
  }

  private static async assertEmpleadoAsistente(empleadoId: number): Promise<void> {
    const e = await prisma.empleado.findFirst({
      where: {
        id: empleadoId,
        deletedAt: null,
        rolId: Roles.ASISTENTE_CONTABILIDAD,
      },
      select: { id: true },
    });
    if (!e) {
      throw new AppError(
        "El colaborador debe existir y tener rol asistente de contabilidad",
        400
      );
    }
  }

  private static async assertEmpresaConsorcio(empresaId: number): Promise<void> {
    const emp = await prisma.empresa.findFirst({
      where: {
        id: empresaId,
        deletedAt: null,
        esConsorcio: true,
      },
      select: { id: true },
    });
    if (!emp) {
      throw new AppError(
        "La empresa debe existir y estar marcada como consorcio",
        400
      );
    }
  }

  private static async assertUniqueActivePair(
    empleadoId: number,
    empresaId: number,
    excludeAccesoId?: number
  ): Promise<void> {
    const existing =
      await AccesoContabilidadRepository.findActiveByEmpleadoEmpresa(
        empleadoId,
        empresaId,
        excludeAccesoId
      );
    if (existing) {
      throw new AppError(
        "Ya existe un acceso activo para este colaborador y esta empresa",
        409
      );
    }
  }

  static async create(
    dto: CreateAccesoContabilidadDto,
    creadoPorEmpleadoId: number
  ): Promise<AccesoContabilidadWithRelations> {
    await this.assertEmpleadoAsistente(dto.empleadoId);
    await this.assertEmpresaConsorcio(dto.empresaId);
    await this.assertUniqueActivePair(dto.empleadoId, dto.empresaId);

    return AccesoContabilidadRepository.create({
      empleado: { connect: { id: dto.empleadoId } },
      empresa: { connect: { id: dto.empresaId } },
      creadoPor: { connect: { id: creadoPorEmpleadoId } },
    });
  }

  /**
   * Actualización: soft delete del registro previo y alta de uno nuevo (historial).
   */
  static async updateWithHistory(
    id: number,
    dto: UpdateAccesoContabilidadDto,
    editorEmpleadoId: number
  ): Promise<AccesoContabilidadWithRelations> {
    await this.getByIdActive(id);

    await this.assertEmpleadoAsistente(dto.empleadoId);
    await this.assertEmpresaConsorcio(dto.empresaId);

    const conflict = await AccesoContabilidadRepository.findActiveByEmpleadoEmpresa(
      dto.empleadoId,
      dto.empresaId
    );
    if (conflict && conflict.id !== id) {
      throw new AppError(
        "Ya existe un acceso activo para este colaborador y esta empresa",
        409
      );
    }

    return AccesoContabilidadRepository.replaceWithHistory(
      id,
      dto,
      editorEmpleadoId
    );
  }

  static async softDelete(id: number, editorEmpleadoId: number): Promise<void> {
    await this.getByIdActive(id);
    await AccesoContabilidadRepository.softDelete(id, editorEmpleadoId);
  }

  /**
   * Quién puede ver prorrateo (u otro dato) de un colaborador distinto al propio:
   * - Supervisor de contabilidad: acceso a colaboradores de cualquier empresa (sin comprobar accesos_contabilidad).
   * - Mismo colaborador: permitido.
   * - Asistente (u otros): requiere fila activa en accesos_contabilidad con
   *   empleadoId = viewer y empresaId = empresa del departamento del colaborador observado.
   */
  static async assertViewerCanAccessProrrateoEmpleado(
    viewerEmpleadoId: number,
    viewerRolId: number,
    targetEmpleadoId: number
  ): Promise<void> {
    if (viewerRolId === Roles.SUPERVISOR_CONTABILIDAD) {
      return;
    }
    if (viewerEmpleadoId === targetEmpleadoId) {
      return;
    }

    const target = await prisma.empleado.findFirst({
      where: { id: targetEmpleadoId, deletedAt: null },
      select: {
        departamento: {
          select: {
            empresa: { select: { id: true, nombre: true } },
          },
        },
      },
    });
    if (!target) {
      throw new AppError("Colaborador no encontrado", 404);
    }

    const empresaId = target.departamento?.empresa?.id;
    const empresaNombre =
      target.departamento?.empresa?.nombre?.trim() || "esa empresa";

    if (empresaId == null) {
      throw new AppError(
        "No tiene permiso para ver datos de prorrateo de este colaborador.",
        403
      );
    }

    const acceso =
      await AccesoContabilidadRepository.findActiveByEmpleadoEmpresa(
        viewerEmpleadoId,
        empresaId
      );
    if (!acceso) {
      throw new AppError(
        `No tiene permiso para ver colaboradores de ${empresaNombre}.`,
        403
      );
    }
  }
}
