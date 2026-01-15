// src/repositories/EmpleadoRepository.ts
import { prisma } from "../config/prisma";
import type { Empleado, Prisma } from "@prisma/client";
import { CreateEmpleadoDto } from "../dtos/employee.dto";

export class EmpleadoRepository {
  /** Busca un empleado por su código (ahora marcado @unique) */
  static async findById(id: number): Promise<Empleado | null> {
    return prisma.empleado.findFirst({
      where: { id },
      include: {
        departamento: {
          include: {
            empresa: { select: { nombre: true } },
          },
        },
      },
    });
  }

  /** Busca un empleado por su código (ahora marcado @unique) */
  static async findByCodigo(codigo: string): Promise<Empleado | null> {
    return prisma.empleado.findUnique({
      where: { codigo },
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
    });
    
    // Comparación case-insensitive
    return (
      empleados.find(
        (e) => e.nombreUsuario?.toLowerCase() === usernameLower
      ) || null
    );
  }

  /** Busca un empleado por correo electrónico, DNI o nombre de usuario */
  static async findByEmailDniOrUsername(
    identifier: string
  ): Promise<Empleado | null> {
    return prisma.empleado.findFirst({
      where: {
        OR: [
          { correoElectronico: identifier },
          { dni: identifier },
          { nombreUsuario: identifier },
        ],
      },
    });
  }

  /** Crea un nuevo empleado */
  static async createEmpleado(data: CreateEmpleadoDto): Promise<Empleado> {
    const { rolId, departamentoId, ...rest } = data;

    return prisma.empleado.create({
      data: {
        ...rest,
        rol: { connect: { id: rolId } },
        departamento: { connect: { id: departamentoId } },
      },
      include: { departamento: true },
    });
  }

  static async updateEmpleado(
    id: number,
    data: Prisma.EmpleadoUpdateInput
  ): Promise<Empleado> {
    return prisma.empleado.update({
      where: { id },
      data,
      include: { departamento: true },
    });
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
      include: {
        departamento: {
          include: {
            empresa: { select: { nombre: true } },
          },
        },
      },
    });
  }

  static async findByCompany(empresaId: number): Promise<Empleado[]> {
    return prisma.empleado.findMany({
      where: { deletedAt: null, departamento: { empresaId } },
      include: {
        departamento: {
          include: {
            empresa: { select: { nombre: true } },
          },
        },
      },
    });
  }

  static async findAllWithDepartment(): Promise<Empleado[]> {
    return prisma.empleado.findMany({
      where: { deletedAt: null },
      include: {
        departamento: {
          include: {
            empresa: { select: { nombre: true } },
          },
        },
      },
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
      include: {
        departamento: {
          include: {
            empresa: { select: { nombre: true } },
          },
        },
      },
    });
  }

  /** Actualiza la contraseña de un empleado */
  static async updatePassword(id: number, contrasenaHash: string): Promise<Empleado> {
    return prisma.empleado.update({
      where: { id },
      data: { contrasena: contrasenaHash },
    });
  }
}
