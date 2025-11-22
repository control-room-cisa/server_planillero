// src/domain/calculo-horas/politicas-horario/H1_2.ts
import { PoliticaH1 } from "./H1";
import { HorarioTrabajo } from "../types";

/**
 * Política de horario H1.2 - Subtipo 2 de H1
 * Funciona exactamente como H1_1 pero con un desfase de 1 día:
 * - Mar–Vie: 07:00–17:00 (9h, incluye almuerzo) - corresponde a Lun–Jue de H1_1
 * - Sáb:     07:00–16:00 (8h, incluye almuerzo) - corresponde a Vie de H1_1
 * - Dom:     07:00–07:00 (0h, sin almuerzo) - corresponde a Sáb de H1_1 (NO día libre)
 * - Lun:     07:00–07:00 (0h, sin almuerzo, día libre) - corresponde a Dom de H1_1
 */
export class PoliticaH1_2 extends PoliticaH1 {
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

    // Los feriados marcan el día como "día libre"
    if (feriadoInfo.esFeriado) {
      esDiaLibre = true;
    } else {
      // H1_2: Desfase de 1 día respecto a H1_1
      // Lunes (1) → Domingo de H1_1: 0h y día libre
      // Martes (2) → Lunes de H1_1: 07:00-17:00 (9h)
      // Miércoles (3) → Martes de H1_1: 07:00-17:00 (9h)
      // Jueves (4) → Miércoles de H1_1: 07:00-17:00 (9h)
      // Viernes (5) → Jueves de H1_1: 07:00-17:00 (9h)
      // Sábado (6) → Viernes de H1_1: 07:00-16:00 (8h)
      // Domingo (0) → Sábado de H1_1: 0h pero NO día libre
      switch (dia) {
        case 1: // Lunes: 0h y día libre (no laborable) - corresponde a Dom de H1_1
          inicio = "07:00";
          fin = "07:00";
          incluyeAlmuerzo = false;
          cantidadHorasLaborables = 0;
          esDiaLibre = true;
          break;
        case 6: // Sábado: 07:00-16:00 (8h, incluye almuerzo) - corresponde a Vie de H1_1
          inicio = "07:00";
          fin = "16:00";
          incluyeAlmuerzo = true;
          cantidadHorasLaborables = 8;
          esDiaLibre = false;
          break;
        case 0: // Domingo: 0h laborables pero NO día libre (es laborable) - corresponde a Sáb de H1_1
          inicio = "07:00";
          fin = "07:00";
          incluyeAlmuerzo = false;
          cantidadHorasLaborables = 0;
          esDiaLibre = false;
          break;
        default: // Martes a Viernes: 07:00-17:00 (9h, incluye almuerzo) - corresponde a Lun–Jue de H1_1
          inicio = "07:00";
          fin = "17:00";
          incluyeAlmuerzo = true;
          cantidadHorasLaborables = 9;
          esDiaLibre = false;
          break;
      }
    }

    return {
      tipoHorario: "H1_2",
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
