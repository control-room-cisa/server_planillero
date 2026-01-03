// src/domain/calculo-horas/politicas-horario/H1_4.ts
import { PoliticaH1 } from "./H1";
import { HorarioTrabajo } from "../types";

/**
 * Política de horario H1.4 - Subtipo 4 de H1
 * Todos los días de la semana tienen el mismo horario:
 * - Lun–Dom: 07:00–17:00 (9h, incluye almuerzo)
 * - Sin días libres (excepto feriados)
 */
export class PoliticaH1_4 extends PoliticaH1 {
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
      // Todos los días: 07:00-17:00 (9h, incluye almuerzo)
      switch (dia) {
        case 0: // Domingo: 07:00-17:00 (9h, incluye almuerzo)
        case 1: // Lunes: 07:00-17:00 (9h, incluye almuerzo)
        case 2: // Martes: 07:00-17:00 (9h, incluye almuerzo)
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
      tipoHorario: "H1_4",
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
