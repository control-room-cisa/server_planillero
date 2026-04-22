import { prisma } from "../config/prisma";
import type { RangosFechasAlimentacion } from "@prisma/client";

function parseYmdToLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  return new Date(Date.UTC(y, m - 1, d));
}

function toYmd(d: Date): string {
  // Para columnas DATE en Prisma/MySQL, usar UTC evita corrimientos por zona horaria local.
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export class RangosFechasAlimentacionRepository {
  static toDto(row: RangosFechasAlimentacion) {
    return {
      id: row.id,
      codigoNomina: row.codigoNomina,
      fechaInicio: toYmd(row.fechaInicio),
      fechaFin: toYmd(row.fechaFin),
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
        fechaInicio: parseYmdToLocalDate(data.fechaInicio),
        fechaFin: parseYmdToLocalDate(data.fechaFin),
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
        fechaInicio: parseYmdToLocalDate(data.fechaInicio),
        fechaFin: parseYmdToLocalDate(data.fechaFin),
        updatedAt: new Date(),
      },
    });
  }

  static async delete(id: number): Promise<void> {
    await prisma.rangosFechasAlimentacion.delete({ where: { id } });
  }
}
