// src/domain/politicas-horario/H1.ts
import { PoliticaHorarioBase } from "./base";
import { HorarioTrabajo, ConteoHorasTrabajadas } from "../types";

/**
 * Política de horario H1
 * Horario estándar de oficina: 8:00 - 17:00 con 1 hora de almuerzo
 */
export class PoliticaH1 extends PoliticaHorarioBase {
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
      tipoHorario: "H1",
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
          // Lógica para horas extra en H1
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
    return 8; // 8 horas estándar para H1
  }

  protected getHorarioEstandar(): { inicio: string; fin: string } {
    return {
      inicio: "08:00",
      fin: "17:00",
    };
  }

  protected incluyeAlmuerzoDefault(): boolean {
    return true; // H1 incluye almuerzo por defecto
  }

  /**
   * Procesa las horas extra aplicando los recargos según H1
   */
  private procesarHorasExtra(
    conteoActual: any,
    horas: number,
    fecha: string
  ): any {
    // Lógica específica de H1 para horas extra
    // Por ejemplo: primera hora extra 25%, segunda 50%, etc.

    // Implementación básica - puede ser refinada según reglas específicas
    if (this.esDomingo(fecha)) {
      conteoActual.p100 += horas; // Domingo = 100% recargo
    } else if (this.esNocturna(fecha)) {
      conteoActual.p50 += horas; // Nocturna = 50% recargo
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
   * Verifica si es jornada nocturna
   */
  private esNocturna(fecha: string): boolean {
    // Implementar lógica de jornada nocturna
    return false; // Por ahora falso
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
