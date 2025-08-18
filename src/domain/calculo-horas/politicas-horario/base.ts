// src/domain/politicas-horario/base.ts
import { IPoliticaHorario } from "../interfaces";
import { HorarioTrabajo, ConteoHorasTrabajadas } from "../types";
import { RegistroDiarioRepository } from "../../../repositories/RegistroDiarioRepository";
import { FeriadoRepository } from "../../../repositories/FeriadoRepository";
import { EmpleadoRepository } from "../../../repositories/EmpleadoRepository";
import { ResultadoSegmentacion, segmentarRegistroDiario } from "./segmentador";

/**
 * Clase base abstracta para todas las políticas de horario
 */
export abstract class PoliticaHorarioBase implements IPoliticaHorario {
  abstract getHorarioTrabajoByDateAndEmpleado(
    fecha: string,
    empleadoId: string
  ): Promise<HorarioTrabajo>;

  abstract getConteoHorasTrabajajadasByDateAndEmpleado(
    fechaInicio: string,
    fechaFin: string,
    empleadoId: string
  ): Promise<ConteoHorasTrabajadas>;

  /**
   * Implementación base del método requerido por la interfaz
   */
  async getConteoHorasTrabajadasByDateAndEmpleado(
    fechaInicio: string,
    fechaFin: string,
    empleadoId: string
  ): Promise<ConteoHorasTrabajadas> {
    return this.getConteoHorasTrabajajadasByDateAndEmpleado(
      fechaInicio,
      fechaFin,
      empleadoId
    );
  }

  /**
   * Verifica si una fecha es feriado
   */
  protected async esFeriado(
    fecha: string
  ): Promise<{ esFeriado: boolean; nombre: string }> {
    try {
      const feriado = await FeriadoRepository.findByDate(fecha);
      return {
        esFeriado: !!feriado,
        nombre: feriado?.nombre || "",
      };
    } catch {
      return { esFeriado: false, nombre: "" };
    }
  }

  async generarSegmentosDeDiaConValidacion(
    fecha: string,
    empleadoId: string
  ): Promise<ResultadoSegmentacion> {
    if (!this.validarFormatoFecha(fecha)) {
      throw new Error("Formato de fecha inválido. Use YYYY-MM-DD");
    }

    const reg = await this.getRegistroDiario(empleadoId, fecha);

    if (!reg) {
      // Sin registro: todo LIBRE; NO aplica almuerzo.
      const fake: any = {
        fecha,
        horaEntrada: new Date(`${fecha}T00:00:00`),
        horaSalida: new Date(`${fecha}T00:00:00`),
        esHoraCorrida: true,
        esDiaLibre: true,
        actividades: [],
      };
      return segmentarRegistroDiario(fake);
    }

    // Ideal: include { actividades: { include: { job: true }}} para poblar jobNombre/codigo
    return segmentarRegistroDiario(reg as any);
  }

  /**
   * Obtiene el registro diario de un empleado para una fecha
   */
  protected async getRegistroDiario(empleadoId: string, fecha: string) {
    return RegistroDiarioRepository.findByEmpleadoAndDateWithActivities(
      parseInt(empleadoId),
      fecha
    );
  }

  /**
   * Obtiene la información del empleado
   */
  protected async getEmpleado(empleadoId: string) {
    return EmpleadoRepository.findById(parseInt(empleadoId));
  }

  /**
   * Calcula las horas laborables base según el tipo de horario
   */
  protected abstract getHorasLaborablesBase(): number;

  /**
   * Obtiene el horario estándar de trabajo (inicio y fin)
   */
  protected abstract getHorarioEstandar(): { inicio: string; fin: string };

  /**
   * Determina si incluye almuerzo por defecto
   */
  protected abstract incluyeAlmuerzoDefault(): boolean;

  /**
   * Convierte una fecha string a formato de visualización
   */
  protected formatearFecha(fecha: string): string {
    return fecha; // Por ahora mantener el formato original
  }

  /**
   * Valida el formato de fecha YYYY-MM-DD
   */
  protected validarFormatoFecha(fecha: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    return regex.test(fecha);
  }
}
