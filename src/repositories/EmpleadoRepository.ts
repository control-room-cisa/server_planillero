// src/repositories/EmpleadoRepository.ts
import { prisma } from "../config/prisma";
import type { Empleado } from "@prisma/client";

export class EmpleadoRepository {
  /** Busca un empleado por su código (ahora marcado @unique) */
  static async findById(id: number): Promise<Empleado | null> {
    return prisma.empleado.findFirst({
      where: { id },
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

  /** Crea un nuevo empleado */
  static async createEmpleado(data: {
    codigo?: string;
    nombre: string;
    apellido?: string | null;
    correoElectronico: string;
    contrasena: string;
    departamentoId: number;
    rolId: number;
  }): Promise<Empleado> {
    return prisma.empleado.create({
      data: {
        codigo: data.codigo,
        nombre: data.nombre,
        apellido: data.apellido,
        correoElectronico: data.correoElectronico,
        contrasena: data.contrasena,
        departamentoId: data.departamentoId,
        rolId: data.rolId,
      },
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

  static async findByDepartment(departamentoId: number): Promise<any[]> {
    return prisma.empleado.findMany({
      where: {
        departamentoId,
        deletedAt: null,
      },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        codigo: true,
        departamento: {
          select: {
            nombre: true,
          },
        },
      },
    });
  }

  static async findByCompany(empresaId: number): Promise<any[]> {
    return prisma.empleado.findMany({
      where: {
        deletedAt: null,
        departamento: {
          empresaId: empresaId,
        },
      },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        codigo: true,
        departamento: {
          select: {
            nombre: true,
            empresaId: true,
          },
        },
      },
    });
  }

  static async findAllWithDepartment(): Promise<any[]> {
    return prisma.empleado.findMany({
      where: {
        deletedAt: null,
      },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        codigo: true,
        departamento: {
          select: {
            nombre: true,
            empresaId: true,
          },
        },
      },
    });
  }
}
