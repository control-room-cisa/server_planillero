import { prisma } from "../config/prisma";
import type { TechoIhss } from "@prisma/client";
import { prismaDateToYmd, ymdToPrismaDate } from "../utils/dateTime";

export class TechoIhssRepository {
  static toDto(row: TechoIhss) {
    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      fechaInicio: prismaDateToYmd(row.fechaInicio),
      fechaFin: prismaDateToYmd(row.fechaFin),
      monto: row.monto,
    };
  }

  static async findAll(): Promise<TechoIhss[]> {
    return prisma.techoIhss.findMany({
      orderBy: { fechaInicio: "desc" },
    });
  }

  static async findPaginated(
    page: number,
    pageSize: number,
  ): Promise<{ rows: TechoIhss[]; total: number }> {
    const [rows, total] = await Promise.all([
      prisma.techoIhss.findMany({
        orderBy: { fechaInicio: "desc" },
        skip: page * pageSize,
        take: pageSize,
      }),
      prisma.techoIhss.count(),
    ]);
    return { rows, total };
  }

  static async findById(id: number): Promise<TechoIhss | null> {
    return prisma.techoIhss.findUnique({ where: { id } });
  }

  static async create(data: {
    fechaInicio: string;
    fechaFin: string;
    monto: number;
  }): Promise<TechoIhss> {
    return prisma.techoIhss.create({
      data: {
        fechaInicio: ymdToPrismaDate(data.fechaInicio),
        fechaFin: ymdToPrismaDate(data.fechaFin),
        monto: data.monto,
      },
    });
  }

  static async update(
    id: number,
    data: { fechaInicio: string; fechaFin: string; monto: number },
  ): Promise<TechoIhss> {
    return prisma.techoIhss.update({
      where: { id },
      data: {
        fechaInicio: ymdToPrismaDate(data.fechaInicio),
        fechaFin: ymdToPrismaDate(data.fechaFin),
        monto: data.monto,
        updatedAt: new Date(),
      },
    });
  }

  static async delete(id: number): Promise<void> {
    await prisma.techoIhss.delete({ where: { id } });
  }
}
