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
    dto: Omit<UpsertRegistroDiarioParams, "empleadoId">
  ): Promise<RegistroDiarioDetail> {
    return (async () => {
      const fecha = dto.fecha;

      // Si el frontend envía horasFeriado, usarlo; si no, calcularlo
      let horasFeriado: number = dto.horasFeriado ?? 0;
      
      // Si no viene del frontend, calcularlo automáticamente (comportamiento anterior)
      if (horasFeriado === 0) {
        const feriado = await FeriadoRepository.findByDate(fecha);
        if (feriado) {
          const horario =
            await HorarioTrabajoDomain.getHorarioTrabajoByDateAndEmpleado(
              fecha,
              String(empleadoId)
            );
          // Nota: horario.cantidadHorasLaborables será 0 cuando es feriado
          // Por eso el frontend debe enviar el valor calculado
          horasFeriado = horario.cantidadHorasLaborables ?? 0;
        }
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
