// src/domain/calculo-horas/politicas-horario/H1_3.ts
import { PoliticaH1 } from "./H1";
import { HorarioTrabajo } from "../types";

/**
 * Política de horario H1.3 - Subtipo 3 de H1
 * Implementa la misma lógica que H1:
 * - Mie–Sáb: 07:00–17:00 (9h, incluye almuerzo)
 * - Dom:     07:00–16:00 (8h, incluye almuerzo)
 * - Lun:     07:00–07:00 (0h, sin almuerzo)
 * - Mar:     07:00–07:00 (0h, sin almuerzo, día libre)
 */
export class PoliticaH1_3 extends PoliticaH1 {
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
      switch (dia) {
        case 0: // Domingo: 07:00-16:00 (8h, incluye almuerzo)
          inicio = "07:00";
          fin = "16:00";
          incluyeAlmuerzo = true;
          cantidadHorasLaborables = 8;
          esDiaLibre = false;
          break;
        case 1: // Lunes: 07:00-07:00 (0h, sin almuerzo)
          inicio = "07:00";
          fin = "07:00";
          incluyeAlmuerzo = false;
          cantidadHorasLaborables = 0;
          esDiaLibre = false;
          break;
        case 2: // Martes: 07:00-07:00 (0h, sin almuerzo, día libre)
          inicio = "07:00";
          fin = "07:00";
          incluyeAlmuerzo = false;
          cantidadHorasLaborables = 0;
          esDiaLibre = true;
          break;
        case 3: // Miércoles: 07:00-17:00 (9h, incluye almuerzo)
        case 4: // Jueves: 07:00-17:00 (9h, incluye almuerzo)
        case 5: // Viernes: 07:00-17:00 (9h, incluye almuerzo)
        case 6: // Sábado: 07:00-17:00 (9h, incluye almuerzo)
          inicio = "07:00";
          fin = "17:00";
          incluyeAlmuerzo = true;
          cantidadHorasLaborables = 9;
          esDiaLibre = false;
          break;
      }
    }

    return {
      tipoHorario: "H1_3",
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
