import { JobRepository } from "../repositories/JobRepository";
import type { Job } from "@prisma/client";

export class JobService {
  /** Lógica de negocio: listar jobs */
  static async listJobs(): Promise<Job[]> {
    // Por ejemplo, podrías filtrar sólo los activos, etc.
    return JobRepository.findAll();
  }
}