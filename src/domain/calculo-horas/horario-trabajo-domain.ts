// src/domain/horario-trabajo-domain.ts
import { TipoHorario } from "@prisma/client";
import { HorarioTrabajo, ConteoHorasTrabajadas, LineaTiempoDia } from "./types";
import { FabricaPoliticas } from "./politicas-horario/fabrica-politicas";
import { SegmentadorTiempo } from "./segmentador-tiempo";
import { EmpleadoRepository } from "../../repositories/EmpleadoRepository";
import { RegistroDiarioRepository } from "../../repositories/RegistroDiarioRepository";

/**
 * Servicio principal del dominio de horarios de trabajo
 */
export class HorarioTrabajoDomain {
  /**
   * Obtiene el horario de trabajo de un empleado para una fecha específica
   */
  static async getHorarioTrabajoByDateAndEmpleado(
    fecha: string,
    empleadoId: string
  ): Promise<HorarioTrabajo> {
    // Obtener empleado y su tipo de horario
    const empleado = await EmpleadoRepository.findById(parseInt(empleadoId));
    if (!empleado) {
      throw new Error(`Empleado con ID ${empleadoId} no encontrado`);
    }

    if (!empleado.tipoHorario) {
      throw new Error(
        `Empleado ${empleadoId} no tiene tipo de horario asignado`
      );
    }

    // Crear política de horario correspondiente
    const politica = FabricaPoliticas.crearPolitica(empleado.tipoHorario);

    // Obtener horario usando la política específica
    return politica.getHorarioTrabajoByDateAndEmpleado(fecha, empleadoId);
  }

  /**
   * Obtiene el conteo de horas trabajadas por un empleado en un período
   */
  static async getConteoHorasTrabajadasByDateAndEmpleado(
    fechaInicio: string,
    fechaFin: string,
    empleadoId: string
  ): Promise<ConteoHorasTrabajadas> {
    // Obtener empleado y su tipo de horario
    const empleado = await EmpleadoRepository.findById(parseInt(empleadoId));
    if (!empleado) {
      throw new Error(`Empleado con ID ${empleadoId} no encontrado`);
    }

    if (!empleado.tipoHorario) {
      throw new Error(
        `Empleado ${empleadoId} no tiene tipo de horario asignado`
      );
    }

    // Crear política de horario correspondiente
    const politica = FabricaPoliticas.crearPolitica(empleado.tipoHorario);

    // Obtener conteo usando la política específica
    return politica.getConteoHorasTrabajadasByDateAndEmpleado(
      fechaInicio,
      fechaFin,
      empleadoId
    );
  }

  /**
   * Segmenta el día en intervalos de tiempo para un empleado y fecha específica
   */
  static async segmentarLineaTiempoDia(
    fecha: string,
    empleadoId: string
  ): Promise<LineaTiempoDia> {
    // Obtener registro diario
    const registroDiario =
      await RegistroDiarioRepository.findByEmpleadoAndDateWithActivities(
        parseInt(empleadoId),
        fecha
      );

    if (!registroDiario) {
      throw new Error(
        `No se encontró registro diario para empleado ${empleadoId} en fecha ${fecha}`
      );
    }

    // Segmentar el día usando el registro diario
    return SegmentadorTiempo.segmentarDia(registroDiario);
  }

  /**
   * Verifica si un tipo de horario está soportado
   */
  static esTipoHorarioSoportado(tipoHorario: TipoHorario): boolean {
    return FabricaPoliticas.esTipoSoportado(tipoHorario);
  }

  /**
   * Obtiene los tipos de horario soportados
   */
  static getTiposHorarioSoportados(): TipoHorario[] {
    return FabricaPoliticas.getTiposSoportados();
  }

  /**
   * Obtiene los tipos de horario pendientes de implementación
   */
  static getTiposHorarioPendientes(): TipoHorario[] {
    return FabricaPoliticas.getTiposPendientes();
  }
}
