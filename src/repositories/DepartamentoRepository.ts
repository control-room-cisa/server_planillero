import { prisma } from "../config/prisma";
import type { Departamento } from "@prisma/client";

export class DepartamentoRepository {
  /** Devuelve todos los departamentos de una empresa (no eliminados) */
  static async findByEmpresaId(empresaId: number): Promise<Departamento[]> {
    return prisma.departamento.findMany({
      where: {
        empresaId,
        deletedAt: null,
      },
      orderBy: {
        nombre: "asc",
      },
    });
  }

  static async findById(id: number): Promise<Departamento | null> {
    return prisma.departamento.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });
  }

  static async create(data: {
    empresaId: number;
    nombre: string;
    codigo?: string;
  }): Promise<Departamento> {
    return prisma.departamento.create({
      data: {
        empresaId: data.empresaId,
        nombre: data.nombre.trim(),
        codigo: data.codigo?.trim() || null,
      },
    });
  }

  static async update(
    id: number,
    data: { nombre?: string; codigo?: string }
  ): Promise<Departamento> {
    return prisma.departamento.update({
      where: { id },
      data: {
        ...(data.nombre !== undefined && { nombre: data.nombre.trim() }),
        ...(data.codigo !== undefined && {
          codigo: data.codigo?.trim() || null,
        }),
        updatedAt: new Date(),
      },
    });
  }

  static async softDelete(id: number): Promise<Departamento> {
    return prisma.departamento.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  static async findByNameAndEmpresa(
    nombre: string,
    empresaId: number
  ): Promise<Departamento | null> {
    return prisma.departamento.findFirst({
      where: {
        nombre: {
          equals: nombre.trim(),
        },
        empresaId,
        deletedAt: null,
      },
    });
  }

  static async findByCodigo(
    codigo: string
  ): Promise<Departamento | null> {
    return prisma.departamento.findFirst({
      where: {
        codigo: {
          equals: codigo.trim(),
        },
        deletedAt: null,
      },
    });
  }
}

