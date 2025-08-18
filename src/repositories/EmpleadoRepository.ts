// src/repositories/EmpleadoRepository.ts
import { prisma } from "../config/prisma";
import type { Empleado, Prisma } from "@prisma/client";
import { CreateEmpleadoDto } from "../dtos/employee.dto";

export class EmpleadoRepository {
  /** Busca un empleado por su código (ahora marcado @unique) */
  static async findById(id: number): Promise<Empleado | null> {
    console.log("id", id);
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
}
