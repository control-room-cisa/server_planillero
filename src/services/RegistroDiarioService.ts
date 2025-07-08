// src/services/RegistroDiarioService.ts
import {
  RegistroDiarioRepository,
  UpsertRegistroDiarioParams,
  RegistroDiarioDetail
} from "../repositories/RegistroDiarioRepository";

export class RegistroDiarioService {
  /**
   * Crea o actualiza el registro diario + actividades.
   * El campo `fecha` se maneja siempre como string "YYYY-MM-DD".
   */
  static upsertRegistro(
    empleadoId: number,
    dto: Omit<UpsertRegistroDiarioParams, "empleadoId">
  ): Promise<RegistroDiarioDetail> {
    return RegistroDiarioRepository.upsertWithActivities({
      empleadoId,
      ...dto
    });
  }

  /**
   * Recupera el registro diario de un empleado por fecha "YYYY-MM-DD"
   */
  static getByDate(
    empleadoId: number,
    fecha: string
  ): Promise<RegistroDiarioDetail | null> {
    return RegistroDiarioRepository.findByEmpleadoAndDateWithActivities(
      empleadoId,
      fecha
    );
  }
}
