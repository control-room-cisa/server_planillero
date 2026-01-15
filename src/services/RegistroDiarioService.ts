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
import { AppError } from "../errors/AppError";

export class RegistroDiarioService {
  /**
   * Crea o actualiza el registro diario + actividades.
   * El campo `fecha` se maneja siempre como string "YYYY-MM-DD".
   * Valida que el registro no esté aprobado por supervisor antes de permitir la actualización.
   */
  static upsertRegistro(
    empleadoId: number,
    dto: Omit<UpsertRegistroDiarioParams, "empleadoId">
  ): Promise<RegistroDiarioDetail> {
    return (async () => {
      const fecha = dto.fecha;

      // Validar que el registro no esté aprobado por supervisor
      const registroExistente =
        await RegistroDiarioRepository.findByEmpleadoAndDateWithActivities(
          empleadoId,
          fecha
        );

      if (registroExistente && registroExistente.aprobacionSupervisor === true) {
        throw new AppError(
          "No se puede modificar un registro diario que ya ha sido aprobado por el supervisor",
          409 // Conflict - el recurso ya está en un estado que no permite la modificación
        );
      }

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

  static async revertirRrhhApprovalByDateRange(
    empleadoId: number,
    fechaInicio: string,
    fechaFin: string
  ): Promise<{ count: number }> {
    return RegistroDiarioRepository.revertirRrhhApprovalByDateRange(
      empleadoId,
      fechaInicio,
      fechaFin
    );
  }

  /**
   * Permite a un supervisor actualizar el job y descripción de una actividad específica
   * de otro empleado. Solo disponible para supervisores (rolId = Roles.SUPERVISOR).
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
