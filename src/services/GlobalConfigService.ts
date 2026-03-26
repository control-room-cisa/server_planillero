import type { GlobalConfig } from "@prisma/client";
import { GlobalConfigRepository } from "../repositories/GlobalConfigRepository";
import type { UpsertGlobalConfigDto } from "../validators/globalConfig.validator";

export class GlobalConfigService {
  static async list(): Promise<GlobalConfig[]> {
    return GlobalConfigRepository.list();
  }

  static async get(key: string): Promise<GlobalConfig | null> {
    return GlobalConfigRepository.get(key);
  }

  static async upsert(dto: UpsertGlobalConfigDto): Promise<GlobalConfig> {
    return GlobalConfigRepository.upsert(dto);
  }

  static async delete(key: string): Promise<void> {
    const existing = await GlobalConfigRepository.get(key);
    if (!existing) throw new Error("Config no encontrada");
    await GlobalConfigRepository.delete(key);
  }
}

