// src/domain/calculo-horas/politicas-horario/H1_3.ts
import { PoliticaH1 } from "./H1";
import { HorarioTrabajo } from "../types";

/**
 * Política de horario H1.3 - Subtipo 3 de H1
 * Hereda toda la lógica de cálculo de H1Base
 * Solo sobrescribe cómo se genera el horario de trabajo
 * 
 * TODO: Implementar la lógica específica de generación de horario para H1.3
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

    // Los feriados y domingos marcan el día como "día libre"
    if (feriadoInfo.esFeriado) {
      esDiaLibre = true;
    } else {
      // H1.3: Implementar lógica específica de generación de horario aquí
      // Por ahora usa la misma lógica que H1 como placeholder
      switch (dia) {
        case 0: // Domingo: 0h y día libre (no laborable)
          inicio = "07:00";
          fin = "07:00";
          incluyeAlmuerzo = false;
          cantidadHorasLaborables = 0;
          esDiaLibre = true;
          break;
        case 6: // Sábado: 0h laborables pero NO día libre (es laborable)
          inicio = "07:00";
          fin = "07:00";
          incluyeAlmuerzo = false;
          cantidadHorasLaborables = 0;
          esDiaLibre = false;
          break;
        case 5:
          inicio = "07:00";
          fin = "16:00";
          incluyeAlmuerzo = true;
          cantidadHorasLaborables = 8;
          break;
        default:
          inicio = "07:00";
          fin = "17:00";
          incluyeAlmuerzo = true;
          cantidadHorasLaborables = 9;
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

