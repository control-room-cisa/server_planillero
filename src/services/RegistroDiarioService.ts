// src/services/RegistroDiarioService.ts
import {
  SupervisorApprovalDto,
  RrhhApprovalDto,
} from "../dtos/RegistroDiarioApproval.dto";
import {
  RegistroDiarioRepository,
  UpsertRegistroDiarioParams,
  RegistroDiarioDetail,
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
      ...dto,
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
  static aprobarSupervisor(
    registroDiarioId: number,
    dto: SupervisorApprovalDto
  ) {
    return RegistroDiarioRepository.updateSupervisorApproval(
      registroDiarioId,
      dto
    );
  }

  /**
   * Actualiza la aprobación de RRHH de un registro diario.
   */
  static aprobarRrhh(registroDiarioId: number, dto: RrhhApprovalDto) {
    return RegistroDiarioRepository.updateRrhhApproval(registroDiarioId, dto);
  }

  /**
   * Permite a un supervisor actualizar el job de una actividad específica
   * de otro empleado. Solo disponible para supervisores (rolId = 2).
   */
  static async updateJobBySupervisor(
    supervisorId: number,
    empleadoId: number,
    dto: { actividadId: number; nuevoJobId: number }
  ) {
    return RegistroDiarioRepository.updateJobBySupervisor(
      supervisorId,
      empleadoId,
      dto
    );
  }
}
