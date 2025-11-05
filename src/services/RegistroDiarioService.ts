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
import { HorarioTrabajoDomain } from "../domain/calculo-horas/horario-trabajo-domain";
import { FeriadoRepository } from "../repositories/FeriadoRepository";

export class RegistroDiarioService {
  /**
   * Crea o actualiza el registro diario + actividades.
   * El campo `fecha` se maneja siempre como string "YYYY-MM-DD".
   */
  static upsertRegistro(
    empleadoId: number,
    dto: Omit<UpsertRegistroDiarioParams, "empleadoId" | "horasFeriado">
  ): Promise<RegistroDiarioDetail> {
    return (async () => {
      const fecha = dto.fecha;

      // Verificar si la fecha es feriado
      const feriado = await FeriadoRepository.findByDate(fecha);

      // Siempre sobreescribir: 0 si no es feriado; si es feriado, horas programadas
      let horasFeriado: number = 0;
      if (feriado) {
        const horario =
          await HorarioTrabajoDomain.getHorarioTrabajoByDateAndEmpleado(
            fecha,
            String(empleadoId)
          );
        horasFeriado = horario.cantidadHorasLaborables ?? 0;
      }

      return RegistroDiarioRepository.upsertWithActivities({
        empleadoId,
        ...dto,
        horasFeriado,
      });
    })();
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
   * Actualiza la aprobación de RRHH a true para todos los registros diarios
   * de un empleado en un rango de fechas.
   */
  static async aprobarRrhhByDateRange(
    empleadoId: number,
    fechaInicio: string,
    fechaFin: string,
    codigoRrhh?: string
  ): Promise<{ count: number }> {
    return RegistroDiarioRepository.updateRrhhApprovalByDateRange(
      empleadoId,
      fechaInicio,
      fechaFin,
      codigoRrhh
    );
  }

  /**
   * Permite a un supervisor actualizar el job y descripción de una actividad específica
   * de otro empleado. Solo disponible para supervisores (rolId = 2).
   */
  static async updateJobBySupervisor(
    supervisorId: number,
    empleadoId: number,
    dto: { actividadId: number; nuevoJobId: number; descripcion?: string }
  ) {
    return RegistroDiarioRepository.updateJobBySupervisor(
      supervisorId,
      empleadoId,
      dto
    );
  }
}
