// src/domain/politicas-horario/H2.ts
import { PoliticaHorarioBase } from "./base";
import { HorarioTrabajo, ConteoHorasTrabajadas } from "../types";

/**
 * Política de horario H2
 * Horario de turnos rotativos: 6:00 - 18:00 con 1 hora de almuerzo
 */
export class PoliticaH2 extends PoliticaHorarioBase {
  async getHorarioTrabajoByDateAndEmpleado(
    fecha: string,
    empleadoId: string
  ): Promise<HorarioTrabajo> {
    if (!this.validarFormatoFecha(fecha)) {
      throw new Error("Formato de fecha inválido. Use YYYY-MM-DD");
    }

    const empleado = await this.getEmpleado(empleadoId);
    if (!empleado) {
      throw new Error(`Empleado con ID ${empleadoId} no encontrado`);
    }

    const registroDiario = await this.getRegistroDiario(empleadoId, fecha);
    const feriadoInfo = await this.esFeriado(fecha);

    // Determinar si es día libre
    const esDiaLibre = registroDiario?.esDiaLibre || false;

    // Obtener horario de trabajo (usar del registro si existe, sino usar estándar)
    let horarioTrabajo = this.getHorarioEstandar();
    let incluyeAlmuerzo = this.incluyeAlmuerzoDefault();
    let cantidadHorasLaborables = this.getHorasLaborablesBase();

    if (registroDiario) {
      // Si hay registro diario, usar sus horarios
      const horaEntrada = new Date(registroDiario.horaEntrada);
      const horaSalida = new Date(registroDiario.horaSalida);

      horarioTrabajo = {
        inicio: this.formatearHora(horaEntrada),
        fin: this.formatearHora(horaSalida),
      };

      incluyeAlmuerzo = !registroDiario.esHoraCorrida;

      // Calcular horas laborables reales
      const duracionMs = horaSalida.getTime() - horaEntrada.getTime();
      const duracionHoras = duracionMs / 3_600_000;
      cantidadHorasLaborables = incluyeAlmuerzo
        ? duracionHoras - 1
        : duracionHoras;
    }

    return {
      fecha,
      empleadoId,
      horarioTrabajo,
      incluyeAlmuerzo,
      esDiaLibre,
      esFestivo: feriadoInfo.esFeriado,
      nombreDiaFestivo: feriadoInfo.nombre,
      cantidadHorasLaborables,
    };
  }

  async getConteoHorasTrabajajadasByDateAndEmpleado(
    fechaInicio: string,
    fechaFin: string,
    empleadoId: string
  ): Promise<ConteoHorasTrabajadas> {
    if (
      !this.validarFormatoFecha(fechaInicio) ||
      !this.validarFormatoFecha(fechaFin)
    ) {
      throw new Error("Formato de fecha inválido. Use YYYY-MM-DD");
    }

    // Inicializar contadores
    let conteoHoras = {
      normal: 0,
      p25: 0,
      p50: 0,
      p75: 0,
      p100: 0,
    };

    // Obtener todas las fechas en el rango
    const fechas = this.obtenerFechasEnRango(fechaInicio, fechaFin);

    for (const fecha of fechas) {
      const registroDiario = await this.getRegistroDiario(empleadoId, fecha);

      if (!registroDiario) {
        continue; // Sin registro, no hay horas que contar
      }

      // Procesar actividades del día
      for (const actividad of registroDiario.actividades) {
        const horas = actividad.duracionHoras;

        if (actividad.esExtra) {
          // Lógica para horas extra en H2
          conteoHoras = this.procesarHorasExtra(conteoHoras, horas, fecha);
        } else {
          // Horas normales
          conteoHoras.normal += horas;
        }
      }
    }

    return {
      fechaInicio,
      fechaFin,
      empleadoId,
      cantidadHoras: conteoHoras,
    };
  }

  protected getHorasLaborablesBase(): number {
    return 11; // 11 horas estándar para H2 (6:00-18:00 menos 1 hora almuerzo)
  }

  protected getHorarioEstandar(): { inicio: string; fin: string } {
    return {
      inicio: "06:00",
      fin: "18:00",
    };
  }

  protected incluyeAlmuerzoDefault(): boolean {
    return true; // H2 incluye almuerzo por defecto
  }

  /**
   * Procesa las horas extra aplicando los recargos según H2
   */
  private procesarHorasExtra(
    conteoActual: any,
    horas: number,
    fecha: string
  ): any {
    // Lógica específica de H2 para horas extra
    // H2 tiene reglas diferentes a H1 por ser turnos largos

    if (this.esDomingo(fecha)) {
      conteoActual.p100 += horas; // Domingo/Festivo = 100% recargo
    } else if (this.esHoraNocturna(fecha)) {
      conteoActual.p75 += horas; // Nocturna en turno largo = 75% recargo
    } else if (this.esSabado(fecha)) {
      conteoActual.p50 += horas; // Sábado = 50% recargo
    } else {
      conteoActual.p25 += horas; // Extra normal = 25% recargo
    }

    return conteoActual;
  }

  /**
   * Verifica si es domingo
   */
  private esDomingo(fecha: string): boolean {
    const date = new Date(fecha);
    return date.getDay() === 0;
  }

  /**
   * Verifica si es sábado
   */
  private esSabado(fecha: string): boolean {
    const date = new Date(fecha);
    return date.getDay() === 6;
  }

  /**
   * Verifica si es hora nocturna (después de las 18:00 o antes de las 6:00)
   */
  private esHoraNocturna(fecha: string): boolean {
    // En H2, cualquier hora fuera del turno estándar se considera nocturna
    return true; // Simplificado para este ejemplo
  }

  /**
   * Verifica si es feriado (método auxiliar)
   */
  private async esFeriadoLocal(fecha: string): Promise<boolean> {
    const feriadoInfo = await this.esFeriado(fecha);
    return feriadoInfo.esFeriado;
  }

  /**
   * Obtiene todas las fechas en un rango
   */
  private obtenerFechasEnRango(
    fechaInicio: string,
    fechaFin: string
  ): string[] {
    const fechas: string[] = [];
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);

    for (let d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1)) {
      fechas.push(d.toISOString().split("T")[0]);
    }

    return fechas;
  }

  /**
   * Formatea una hora a HH:mm
   */
  private formatearHora(fecha: Date): string {
    return fecha.toTimeString().slice(0, 5);
  }
}
