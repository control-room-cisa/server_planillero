import { prisma } from "../config/prisma";
import type { Departamento, Empresa } from "@prisma/client";
import type { CreateEmpresaDto, UpdateEmpresaDto } from "../dtos/empresa.dto";

export class EmpresaRepository {
  /** Devuelve todas las empresas */
  static async findAll(): Promise<Empresa[]> {
    return prisma.empresa.findMany();
  }

  // Devuelve todas las empresas activas junto con sus departamentos activos

  static async findAllWithDepartments(): Promise<
    (Empresa & { departamentos: Departamento[] })[]
  > {
    return prisma.empresa.findMany({
      where: { deletedAt: null },
      include: {
        departamentos: {
          where: { deletedAt: null },
        },
      },
    });
  }

  static async create(data: CreateEmpresaDto): Promise<Empresa> {
    return prisma.empresa.create({
      data: {
        nombre: data.nombre,
        codigo: data.codigo,
        esConsorcio: data.esConsorcio ?? false,
      },
    });
  }

  static async update(id: number, data: UpdateEmpresaDto): Promise<Empresa> {
    return prisma.empresa.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  static async softDelete(id: number): Promise<Empresa> {
    return prisma.empresa.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  static async findById(id: number): Promise<Empresa | null> {
    return prisma.empresa.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });
  }

  static async findByName(nombre: string): Promise<Empresa | null> {
    return prisma.empresa.findFirst({
      where: {
        nombre: {
          equals: nombre,
        },
        deletedAt: null,
      },
    });
  }

  static async findByCodigo(codigo: string): Promise<Empresa | null> {
    return prisma.empresa.findFirst({
      where: {
        codigo: {
          equals: codigo.trim(),
        },
        deletedAt: null,
      },
    });
  }
}
