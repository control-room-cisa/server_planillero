// src/repositories/ProrrateoRepository.ts
import type { Prisma, TipoProrrateo } from "@prisma/client";
import { prisma } from "../config/prisma";

export type ProrrateoCreateRow = {
  nominaId: number;
  jobId: number | null;
  codigoJob: string | null;
  codigoClass: string | null;
  cantidadHoras: number;
  monto: number;
  tipo: TipoProrrateo;
};

type TxClient = Prisma.TransactionClient;

export class ProrrateoRepository {
  static async countByNominaId(
    nominaId: number,
    tx: TxClient = prisma
  ): Promise<number> {
    return tx.prorrateo.count({ where: { nominaId } });
  }

  static async createMany(
    rows: ProrrateoCreateRow[],
    tx: TxClient = prisma
  ): Promise<number> {
    if (rows.length === 0) return 0;
    const result = await tx.prorrateo.createMany({ data: rows });
    return result.count;
  }

  static async findByNominaId(nominaId: number, tx: TxClient = prisma) {
    return tx.prorrateo.findMany({
      where: { nominaId },
      orderBy: [{ tipo: "asc" }, { id: "asc" }],
    });
  }
}
