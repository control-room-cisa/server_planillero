// src/domain/interfaces.ts
import { HorarioTrabajo, ConteoHorasTrabajadas } from "./types";

/**
 * Interfaz base para las políticas de horario (H1, H2, etc.)
 */
export interface IPoliticaHorario {
  /**
   * Obtiene el horario de trabajo de un empleado en una fecha específica
   */
  getHorarioTrabajoByDateAndEmpleado(
    fecha: string,
    empleadoId: string
  ): Promise<HorarioTrabajo>;

  /**
   * Obtiene el conteo de horas trabajadas por un empleado en un período
   */
  getConteoHorasTrabajadasByDateAndEmpleado(
    fechaInicio: string,
    fechaFin: string,
    empleadoId: string
  ): Promise<ConteoHorasTrabajadas>;
}
