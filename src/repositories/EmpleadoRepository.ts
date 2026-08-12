// src/repositories/EmpleadoRepository.ts
import { prisma } from "../config/prisma";
import type { Empleado, Prisma } from "@prisma/client";
import { CreateEmpleadoDto } from "../dtos/employee.dto";
import { normalizeRolIdsList } from "../utils/roles";

const rolesInclude = {
  roles: { select: { rolId: true } },
} as const;

const departamentoInclude = {
  departamento: {
    include: {
      empresa: { select: { nombre: true, codigo: true } },
    },
  },
  ...rolesInclude,
} as const;

export class EmpleadoRepository {
  /** Busca un empleado por su código (ahora marcado @unique) */
  static async findById(id: number): Promise<Empleado | null> {
    return prisma.empleado.findFirst({
      where: { id },
      include: departamentoInclude,
    });
  }

  /** Colaborador activo por código (incluye departamento para DTOs / permisos). */
  static async findByCodigo(codigo: string): Promise<Empleado | null> {
    const trimmed = codigo?.trim();
    if (!trimmed) return null;
    return prisma.empleado.findFirst({
      where: { codigo: trimmed, deletedAt: null },
      include: {
        departamento: {
          include: {
            empresa: { select: { id: true, nombre: true } },
          },
        },
        ...rolesInclude,
      },
    });
  }

  /** Busca un empleado por su correo electrónico */
  static async findByEmail(
    correoElectronico: string
  ): Promise<Empleado | null> {
    return prisma.empleado.findFirst({
      where: { correoElectronico },
    });
  }

  /** Busca un empleado por DNI (identidad) */
  static async findByDni(dni: string): Promise<Empleado | null> {
    return prisma.empleado.findFirst({
      where: { dni },
    });
  }

  /** Busca un empleado por nombre de usuario (case-insensitive) */
  static async findByUsername(nombreUsuario: string): Promise<Empleado | null> {
    // Normalizar a minúsculas para la búsqueda
    const usernameLower = nombreUsuario.toLowerCase().trim();

    // Buscar todos los empleados activos y filtrar por comparación case-insensitive
    // Nota: Prisma no soporta directamente búsqueda case-insensitive en MySQL sin raw queries
    // Por eficiencia, buscamos todos y filtramos en memoria (alternativa: usar raw query con LOWER())
    const empleados = await prisma.empleado.findMany({
      where: {
        deletedAt: null,
        nombreUsuario: { not: null },
      },
      include: rolesInclude,
    });

    // Comparación case-insensitive
    return (
      empleados.find(
        (e) => e.nombreUsuario?.toLowerCase() === usernameLower
      ) || null
    );
  }

  /** Busca empleado por correo, DNI, nombre de usuario (exacto o sin distinguir mayúsculas) o código. */
  static async findByEmailDniOrUsername(
    identifier: string
  ): Promise<Empleado | null> {
    const trimmed = identifier.trim();
    if (!trimmed) return null;

    const byCodigo = await prisma.empleado.findFirst({
      where: { codigo: trimmed, deletedAt: null },
      include: rolesInclude,
    });
    if (byCodigo) return byCodigo;

    const direct = await prisma.empleado.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { correoElectronico: trimmed },
          { dni: trimmed },
          { nombreUsuario: trimmed },
        ],
      },
      include: rolesInclude,
    });
    if (direct) return direct;

    return this.findByUsername(trimmed);
  }

  /** Crea un nuevo empleado */
  static async createEmpleado(data: CreateEmpleadoDto): Promise<Empleado> {
    const { rolIds, departamentoId, ...rest } = data;
    const ids = normalizeRolIdsList(rolIds);

    return prisma.empleado.create({
      data: {
        ...rest,
        roles: { create: ids.map((rolId) => ({ rolId })) },
        departamento: { connect: { id: departamentoId } },
      },
      include: { departamento: true, ...rolesInclude },
    });
  }

  static async updateEmpleado(
    id: number,
    data: Prisma.EmpleadoUpdateInput
  ): Promise<Empleado> {
    return prisma.empleado.update({
      where: { id },
      data,
      include: { departamento: true, ...rolesInclude },
    });
  }

  /** Reemplaza los roles del empleado. */
  static async setRoles(empleadoId: number, rolIds: number[]): Promise<void> {
    const ids = normalizeRolIdsList(rolIds);
    await prisma.$transaction([
      prisma.empleadoRol.deleteMany({ where: { empleadoId } }),
      prisma.empleadoRol.createMany({
        data: ids.map((rolId) => ({ empleadoId, rolId })),
      }),
    ]);
  }

  static async findLastCodigo(): Promise<{ codigo: string | null } | null> {
    return prisma.empleado.findFirst({
      where: {
        codigo: {
          not: null,
          startsWith: "EMP",
        },
      },
      orderBy: { codigo: "desc" },
      select: { codigo: true },
    });
  }

  static async findByDepartment(departamentoId: number): Promise<Empleado[]> {
    return prisma.empleado.findMany({
      where: { departamentoId, deletedAt: null },
      include: departamentoInclude,
    });
  }

  static async findByCompany(empresaId: number): Promise<Empleado[]> {
    return prisma.empleado.findMany({
      where: { deletedAt: null, departamento: { empresaId } },
      include: departamentoInclude,
    });
  }

  static async findAllWithDepartment(): Promise<Empleado[]> {
    return prisma.empleado.findMany({
      where: { deletedAt: null },
      include: departamentoInclude,
    });
  }

  /** Busca empleados por una lista de IDs */
  static async findByIds(ids: number[]): Promise<Empleado[]> {
    if (ids.length === 0) return [];
    return prisma.empleado.findMany({
      where: {
        id: { in: ids },
        deletedAt: null,
      },
      include: departamentoInclude,
    });
  }

  /** Actualiza la contraseña de un empleado */
  static async updatePassword(id: number, contrasenaHash: string): Promise<Empleado> {
    return prisma.empleado.update({
      where: { id },
      data: { contrasena: contrasenaHash },
    });
  }

  /** Eliminación lógica de empleado */
  static async softDeleteEmpleado(id: number): Promise<Empleado | null> {
    const existing = await prisma.empleado.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) return null;

    return prisma.empleado.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        activo: false,
      },
    });
  }
}
