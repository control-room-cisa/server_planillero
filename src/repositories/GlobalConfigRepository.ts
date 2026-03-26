import type { GlobalConfig } from "@prisma/client";
import { prisma } from "../config/prisma";

export class GlobalConfigRepository {
  private static delegate() {
    const d = (prisma as any)?.globalConfig;
    if (!d) {
      throw new Error(
        "GlobalConfig no está disponible en Prisma. " +
          "Probablemente falta ejecutar la migración y/o regenerar Prisma Client. " +
          "Ejecuta: `npx prisma migrate dev` y luego `npx prisma generate`."
      );
    }
    return d as typeof prisma.globalConfig;
  }

  static async list(): Promise<GlobalConfig[]> {
    return this.delegate().findMany({ orderBy: { key: "asc" } });
  }

  static async get(key: string): Promise<GlobalConfig | null> {
    return this.delegate().findUnique({ where: { key } });
  }

  static async upsert(data: {
    key: string;
    value: string;
    description?: string | null;
  }): Promise<GlobalConfig> {
    return this.delegate().upsert({
      where: { key: data.key },
      create: {
        key: data.key,
        value: data.value,
        description: data.description ?? null,
      },
      update: {
        value: data.value,
        description: data.description ?? null,
      },
    });
  }

  static async delete(key: string): Promise<void> {
    await this.delegate().delete({ where: { key } });
  }
}

