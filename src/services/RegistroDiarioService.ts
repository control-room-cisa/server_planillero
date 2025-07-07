
import {
  RegistroDiarioRepository,
  UpsertRegistroDiarioParams,
  RegistroDiarioDetail
} from "../repositories/RegistroDiarioRepository";

export class RegistroDiarioService {
  static upsertRegistro(
    empleadoId: number,
    dto: Omit<UpsertRegistroDiarioParams, "empleadoId">
  ): Promise<RegistroDiarioDetail> {
    return RegistroDiarioRepository.upsertWithActivities({ empleadoId, ...dto });
  }

  static getByDate(
    empleadoId: number,
    fecha:      Date
  ): Promise<RegistroDiarioDetail | null> {
    return RegistroDiarioRepository.findByEmpleadoAndDateWithActivities(empleadoId, fecha);
  }
}
