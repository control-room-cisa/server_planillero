import { prisma } from "../config/prisma";
import type { Job } from "@prisma/client";

export class JobRepository {
  /** Devuelve todos los jobs */
  static async findAll(): Promise<Job[]> {
    return prisma.job.findMany({
      include: { empresa: true }  //incluir datos de la empresa
    });
  }
}