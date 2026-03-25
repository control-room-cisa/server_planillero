// src/domain/calculo-horas/politicas-horario/H1_8.ts
import { PoliticaH1 } from "./H1";
import { HorarioTrabajo } from "../types";

/**
 * Política de horario H1.8 - Subtipo 8 de H1
 * Basada en H1.1, pero cambiando únicamente:
 * - Lun–Vie: hora de entrada a las 08:00
 *
 * Mantiene igual que H1.1:
 * - Lun–Jue: 08:00–17:00 (9h, incluye almuerzo)
 * - Vie:     08:00–16:00 (8h, incluye almuerzo)
 * - Sáb:     07:00–07:00 (0h, sin almuerzo)
 * - Dom:     07:00–07:00 (0h, sin almuerzo, día libre)
 */
export class PoliticaH1_8 extends PoliticaH1 {
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
        case 0: // Domingo: 07:00-07:00 (0h, sin almuerzo)
          inicio = "07:00";
          fin = "07:00";
          incluyeAlmuerzo = false;
          cantidadHorasLaborables = 0;
          esDiaLibre = true;
          break;
        case 6: // Sábado: 07:00-07:00 (0h laborables pero sin día libre)
          inicio = "07:00";
          fin = "07:00";
          incluyeAlmuerzo = false;
          cantidadHorasLaborables = 0;
          esDiaLibre = false;
          break;
        case 5: // Viernes: 08:00–16:00 (8h, incluye almuerzo)
          inicio = "08:00";
          fin = "16:00";
          incluyeAlmuerzo = true;
          cantidadHorasLaborables = 8;
          esDiaLibre = false;
          break;
        default: // Lunes a Jueves: 08:00–17:00 (9h, incluye almuerzo)
          inicio = "08:00";
          fin = "17:00";
          incluyeAlmuerzo = true;
          cantidadHorasLaborables = 9;
          esDiaLibre = false;
          break;
      }
    }

    return {
      tipoHorario: "H1_8",
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

