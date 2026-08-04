// src/repositories/BancoCompensatoriasRepository.ts
import type { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

export type BancoCompensatoriaDelta = {
  jobId: number | null;
  horas: number;
};

type TxClient = Prisma.TransactionClient;

/**
 * Aplica deltas al banco de compensatorias acumuladas por empleado/job.
 * - Find + update/create por (empleadoId, jobId), incluyendo jobId null.
 * - No elimina filas en 0; permite saldos negativos.
 */
export class BancoCompensatoriasRepository {
  static async aplicarDeltas(
    empleadoId: number,
    deltas: BancoCompensatoriaDelta[],
    tx: TxClient = prisma
  ): Promise<void> {
    for (const delta of deltas) {
      const horas = Number(delta.horas || 0);
      if (horas === 0) continue;

      const jobId =
        delta.jobId === null || delta.jobId === undefined
          ? null
          : Number(delta.jobId);

      const existing = await tx.bancoCompensatoriasAcumuladas.findFirst({
        where: { empleadoId, jobId },
      });

      if (existing) {
        await tx.bancoCompensatoriasAcumuladas.update({
          where: { id: existing.id },
          data: { horasAcumuladas: existing.horasAcumuladas + horas },
        });
      } else {
        await tx.bancoCompensatoriasAcumuladas.create({
          data: {
            empleadoId,
            jobId,
            horasAcumuladas: horas,
          },
        });
      }
    }
  }

  static async findByEmpleado(empleadoId: number, tx: TxClient = prisma) {
    return tx.bancoCompensatoriasAcumuladas.findMany({
      where: { empleadoId },
      include: { job: true },
      orderBy: { id: "asc" },
    });
  }
}
