import { prisma } from "../config/prisma";
import type { RangosFechasAlimentacion } from "@prisma/client";
import { prismaDateToYmd, ymdToPrismaDate } from "../utils/dateTime";

export class RangosFechasAlimentacionRepository {
  static toDto(row: RangosFechasAlimentacion) {
    return {
      id: row.id,
      codigoNomina: row.codigoNomina,
      fechaInicio: prismaDateToYmd(row.fechaInicio),
      fechaFin: prismaDateToYmd(row.fechaFin),
    };
  }

  static async listByCodigo(
    codigoNomina: string,
  ): Promise<RangosFechasAlimentacion[]> {
    return prisma.rangosFechasAlimentacion.findMany({
      where: { codigoNomina },
      orderBy: { fechaInicio: "asc" },
    });
  }

  static async findPaginated(
    page: number,
    pageSize: number,
  ): Promise<{ rows: RangosFechasAlimentacion[]; total: number }> {
    const [rows, total] = await Promise.all([
      prisma.rangosFechasAlimentacion.findMany({
        orderBy: { fechaInicio: "desc" },
        skip: page * pageSize,
        take: pageSize,
      }),
      prisma.rangosFechasAlimentacion.count(),
    ]);
    return { rows, total };
  }

  static async findById(id: number): Promise<RangosFechasAlimentacion | null> {
    return prisma.rangosFechasAlimentacion.findUnique({ where: { id } });
  }

  static async findByCodigo(
    codigoNomina: string,
  ): Promise<RangosFechasAlimentacion | null> {
    return prisma.rangosFechasAlimentacion.findFirst({
      where: { codigoNomina },
    });
  }

  static async findManyAll(): Promise<RangosFechasAlimentacion[]> {
    return prisma.rangosFechasAlimentacion.findMany();
  }

  static async countAll(): Promise<number> {
    return prisma.rangosFechasAlimentacion.count();
  }

  static async maxFechaFinGlobal(): Promise<Date | null> {
    const agg = await prisma.rangosFechasAlimentacion.aggregate({
      _max: { fechaFin: true },
    });
    return agg._max.fechaFin;
  }

  /** Último rango: mayor `fechaFin`; desempate por `id` (mayor). */
  static async findConMayorFechaFinDesc(): Promise<RangosFechasAlimentacion | null> {
    return prisma.rangosFechasAlimentacion.findFirst({
      orderBy: [{ fechaFin: "desc" }, { id: "desc" }],
    });
  }

  static async create(data: {
    codigoNomina: string;
    fechaInicio: string;
    fechaFin: string;
  }): Promise<RangosFechasAlimentacion> {
    return prisma.rangosFechasAlimentacion.create({
      data: {
        codigoNomina: data.codigoNomina,
        fechaInicio: ymdToPrismaDate(data.fechaInicio),
        fechaFin: ymdToPrismaDate(data.fechaFin),
      },
    });
  }

  static async update(
    id: number,
    data: { fechaInicio: string; fechaFin: string },
  ): Promise<RangosFechasAlimentacion> {
    return prisma.rangosFechasAlimentacion.update({
      where: { id },
      data: {
        fechaInicio: ymdToPrismaDate(data.fechaInicio),
        fechaFin: ymdToPrismaDate(data.fechaFin),
        updatedAt: new Date(),
      },
    });
  }

  static async delete(id: number): Promise<void> {
    await prisma.rangosFechasAlimentacion.delete({ where: { id } });
  }
}
