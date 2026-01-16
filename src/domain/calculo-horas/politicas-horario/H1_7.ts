// src/domain/calculo-horas/politicas-horario/H1_7.ts
import { PoliticaH1 } from "./H1";
import { HorarioTrabajo } from "../types";

/**
 * Política de horario H1.7 - Subtipo 7 de H1
 * Horario extendido:
 * - Todos los días: 07:00–19:00 (12h, incluye almuerzo)
 * - Domingo: día libre (07:00–07:00, 0h)
 */
export class PoliticaH1_7 extends PoliticaH1 {
  async getHorarioTrabajoByDateAndEmpleado(
    fecha: string,
    empleadoId: string
  ): Promise<HorarioTrabajo> {
    if (!this.validarFormatoFecha(fecha)) {
      throw new Error("Formato de fecha inválido. Use YYYY-MM-DD");
    }

    const empleado = await this.getEmpleado(empleadoId);
    if (!empleado)
      throw new Error(`Empleado con ID ${empleadoId} no encontrado`);

    const feriadoInfo = await this.esFeriado(fecha);
    const dia = new Date(`${fecha}T00:00:00`).getDay(); // 0=Dom

    let inicio = "07:00";
    let fin = "07:00";
    let incluyeAlmuerzo = false;
    let cantidadHorasLaborables = 0;
    let esDiaLibre = false;

    // Los feriados y domingos marcan el día como "día libre"
    if (feriadoInfo.esFeriado) {
      esDiaLibre = true;
    } else {
      switch (dia) {
        case 0: // Domingo: 0h y día libre (no laborable)
          inicio = "07:00";
          fin = "07:00";
          incluyeAlmuerzo = false;
          cantidadHorasLaborables = 0;
          esDiaLibre = true;
          break;
        default: // Lunes a Sábado: 07:00-19:00 (12h, incluye almuerzo)
          inicio = "07:00";
          fin = "19:00";
          incluyeAlmuerzo = true;
          cantidadHorasLaborables = 12;
          esDiaLibre = false;
          break;
      }
    }

    return {
      tipoHorario: "H1_7",
      fecha,
      empleadoId,
      horarioTrabajo: { inicio, fin },
      incluyeAlmuerzo,
      esDiaLibre,
      esFestivo: feriadoInfo.esFeriado,
      nombreDiaFestivo: feriadoInfo.nombre,
      cantidadHorasLaborables,
    };
  }
}

