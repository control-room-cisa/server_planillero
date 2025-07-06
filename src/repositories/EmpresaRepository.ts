import { prisma } from "../config/prisma";
import type { Departamento, Empresa } from "@prisma/client";

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
        }
      }
    });
  }
}
