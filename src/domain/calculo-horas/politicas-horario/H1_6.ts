// src/domain/calculo-horas/politicas-horario/H1_6.ts
import { PoliticaH1 } from "./H1";
import { HorarioTrabajo } from "../types";

/**
 * Política de horario H1.6 - Subtipo 6 de H1
 * Horario específico:
 * - Lun–Vie: 08:00–17:00 (9h, incluye almuerzo)
 * - Sáb:     08:00–12:00 (4h, sin almuerzo)
 * - Dom:     08:00–08:00 (0h, sin almuerzo, día libre)
 */
export class PoliticaH1_6 extends PoliticaH1 {
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

    let inicio = "08:00";
    let fin = "08:00";
    let incluyeAlmuerzo = false;
    let cantidadHorasLaborables = 0;
    let esDiaLibre = false;

    // Los feriados marcan el día como "día libre"
    if (feriadoInfo.esFeriado) {
      esDiaLibre = true;
    } else {
      switch (dia) {
        case 0: // Domingo: 08:00-08:00 (0h, sin almuerzo, día libre)
          inicio = "08:00";
          fin = "08:00";
          incluyeAlmuerzo = false;
          cantidadHorasLaborables = 0;
          esDiaLibre = true;
          break;
        case 1: // Lunes: 08:00-17:00 (9h, incluye almuerzo)
        case 2: // Martes: 08:00-17:00 (9h, incluye almuerzo)
        case 3: // Miércoles: 08:00-17:00 (9h, incluye almuerzo)
        case 4: // Jueves: 08:00-17:00 (9h, incluye almuerzo)
        case 5: // Viernes: 08:00-17:00 (9h, incluye almuerzo)
          inicio = "08:00";
          fin = "17:00";
          incluyeAlmuerzo = true;
          cantidadHorasLaborables = 9;
          esDiaLibre = false;
          break;
        case 6: // Sábado: 08:00-12:00 (4h, sin almuerzo)
          inicio = "08:00";
          fin = "12:00";
          incluyeAlmuerzo = false;
          cantidadHorasLaborables = 4;
          esDiaLibre = false;
          break;
      }
    }

    return {
      tipoHorario: "H1_6",
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
