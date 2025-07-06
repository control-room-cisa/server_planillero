// src/services/PlanillaDiaService.ts
import { PlanillaDiaRepository } from "../repositories/PlanillaDiaRepository";
import type {
  UpsertDiaWithActivitiesParams,
  PlanillaDiaDetail
} from "../repositories/PlanillaDiaRepository";

export class PlanillaDiaService {
  /**
   * Inserta o actualiza un día y sus actividades en un solo paso.
   */
  static async upsertDia(
    params: UpsertDiaWithActivitiesParams
  ): Promise<PlanillaDiaDetail> {
    return PlanillaDiaRepository.upsertDiaWithActivities(params);
  }
}
