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
import { prisma } from "../config/prisma";
import { HorarioTrabajoDomain } from "../domain/calculo-horas/horario-trabajo-domain";
import { FeriadoRepository } from "../repositories/FeriadoRepository";
import { AppError } from "../errors/AppError";

export class RegistroDiarioService {
  /**
   * Crea o actualiza el registro diario + actividades.
   * El campo `fecha` se maneja siempre como string "YYYY-MM-DD".
   * Permite modificación en las mismas condiciones que el front:
   * - Bloquea siempre si aprobacionRrhh === true.
   * - Si RRHH no aprobó en true, bloquea cuando aprobacionSupervisor === true Y aprobacionRrhh !== false.
   * - Permite si aprobacionRrhh === false (rechazado por RRHH, puede corregir).
   */
  static upsertRegistro(
    empleadoId: number,
    dto: Omit<UpsertRegistroDiarioParams, "empleadoId">
  ): Promise<RegistroDiarioDetail> {
    return (async () => {
      const fecha = dto.fecha;

      const registroExistente =
        await RegistroDiarioRepository.findByEmpleadoAndDateWithActivities(
          empleadoId,
          fecha
        );

      // Bloqueos de edición alineados con reglas de aprobación:
      // 1) RRHH aprobado en true bloquea SIEMPRE.
      // 2) Si RRHH no rechazó, supervisor aprobado también bloquea.
      const bloqueado =
        registroExistente &&
        (registroExistente.aprobacionRrhh === true ||
          (registroExistente.aprobacionSupervisor === true &&
            registroExistente.aprobacionRrhh !== false));

      if (bloqueado) {
        throw new AppError(
          "No se puede modificar un registro diario con aprobación final",
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
  static async aprobarSupervisor(
    registroDiarioId: number,
    dto: SupervisorApprovalDto
  ) {
    const reg = await prisma.registroDiario.findFirst({
      where: { id: registroDiarioId, deletedAt: null },
      select: { aprobacionRrhh: true },
    });

    if (!reg) {
      throw new AppError("Registro no encontrado", 404);
    }

    if (reg.aprobacionRrhh === true) {
      throw new AppError(
        "No se puede aprobar ni rechazar desde supervisor cuando RRHH ya aprobó el registro",
        409
      );
    }

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
   * Permite actualizar job, descripción y class de una actividad de otro empleado.
   * Roles: SUPERVISOR, SUPERVISOR_CONTABILIDAD, ASISTENTE_CONTABILIDAD.
   */
  static async updateJobBySupervisor(
    supervisorId: number,
    empleadoId: number,
    dto: {
      actividadId: number;
      nuevoJobId: number;
      descripcion?: string;
      className?: number | string | null;
    }
  ) {
    return RegistroDiarioRepository.updateJobBySupervisor(
      supervisorId,
      empleadoId,
      dto
    );
  }

  /**
   * Tiempo compensatorio del empleado:
   * - actividades acumuladas (esExtra=true)
   * - actividades tomadas (esExtra=false)
   * - saldo por job desde banco_compensatorias_acumuladas
   */
  static async getTiempoCompensatorio(empleadoId: number) {
    const [actividades, porJob, empleado] = await Promise.all([
      RegistroDiarioRepository.findActividadesCompensatoriasByEmpleado(
        empleadoId
      ),
      RegistroDiarioRepository.findBancoCompensatoriasByEmpleado(empleadoId),
      prisma.empleado.findFirst({
        where: { id: empleadoId, deletedAt: null },
        select: {
          tiempoVacacionesHoras: true,
          tiempoCompensatorioHoras: true,
        },
      }),
    ]);

    const mapActividad = (a: (typeof actividades)[number]) => ({
      id: a.id,
      fecha: a.registroDiario.fecha,
      empleadoId: a.registroDiario.empleadoId,
      jobId: a.jobId,
      jobCodigo: a.job?.codigo ?? null,
      jobNombre: a.job?.nombre ?? null,
      duracionHoras: a.duracionHoras,
      esExtra: a.esExtra === true,
      esCompensatorio: a.esCompensatorio === true,
      descripcion: a.descripcion,
      horaInicio: a.horaInicio,
      horaFin: a.horaFin,
    });

    const acumuladas = actividades
      .filter((a) => a.esExtra === true)
      .map(mapActividad);
    const tomadas = actividades
      .filter((a) => a.esExtra !== true)
      .map(mapActividad);

    return {
      empleadoId,
      tiempoVacacionesHoras: empleado?.tiempoVacacionesHoras ?? null,
      tiempoCompensatorioHoras: empleado?.tiempoCompensatorioHoras ?? null,
      acumuladas,
      tomadas,
      porJob: porJob.map((row) => ({
        id: row.id,
        empleadoId: row.empleadoId,
        jobId: row.jobId,
        jobCodigo: row.job?.codigo ?? null,
        jobNombre: row.job?.nombre ?? null,
        horasAcumuladas: row.horasAcumuladas,
      })),
      totales: {
        horasAcumuladasActividades: acumuladas.reduce(
          (s, a) => s + (a.duracionHoras || 0),
          0
        ),
        horasTomadasActividades: tomadas.reduce(
          (s, a) => s + (a.duracionHoras || 0),
          0
        ),
        horasAcumuladasPorJob: porJob.reduce(
          (s, r) => s + (r.horasAcumuladas || 0),
          0
        ),
      },
    };
  }
}
