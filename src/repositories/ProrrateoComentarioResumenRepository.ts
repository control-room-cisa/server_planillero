// src/repositories/ProrrateoComentarioResumenRepository.ts
import type { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

export type ProrrateoComentarioResumenCreateRow = {
  nominaId: number;
  jobId: number | null;
  codigoJob: string | null;
  nombreJob: string | null;
  jobKey: string;
  resumen: string;
};

type TxClient = Prisma.TransactionClient;

export class ProrrateoComentarioResumenRepository {
  static async createMany(
    rows: ProrrateoComentarioResumenCreateRow[],
    tx: TxClient = prisma
  ): Promise<number> {
    if (rows.length === 0) return 0;
    const result = await tx.prorrateoComentarioResumen.createMany({
      data: rows,
    });
    return result.count;
  }

  static async findByNominaId(nominaId: number, tx: TxClient = prisma) {
    return tx.prorrateoComentarioResumen.findMany({
      where: { nominaId },
      orderBy: [{ codigoJob: "asc" }, { id: "asc" }],
    });
  }
}
