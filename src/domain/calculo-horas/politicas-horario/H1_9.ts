// src/domain/calculo-horas/politicas-horario/H1_9.ts
import { PoliticaH1 } from "./H1";
import { HorarioTrabajo } from "../types";

/**
 * Política de horario H1.9 - Especial Lunes a Sábado
 * Réplica de H1_1 con sábado medio día:
 * - Lun–Jue: 07:00–17:00 (9h, incluye almuerzo)
 * - Vie:     07:00–16:00 (8h, incluye almuerzo)
 * - Sáb:     07:00–12:00 (5h, sin almuerzo)
 * - Dom:     07:00–07:00 (0h, día libre)
 *
 * En UI: entrada/salida editables (a diferencia de H1_1).
 */
export class PoliticaH1_9 extends PoliticaH1 {
  protected calcularHorarioTrabajoSinConsultas(
    fecha: string,
    empleadoId: string,
    feriadoInfo: { esFeriado: boolean; nombre: string }
  ): HorarioTrabajo {
    const dia = new Date(`${fecha}T00:00:00`).getDay(); // 0=Dom

    let inicio = "07:00";
    let fin = "07:00";
    let incluyeAlmuerzo = false;
    let cantidadHorasLaborables = 0;
    let esDiaLibre = false;

    if (feriadoInfo.esFeriado) {
      esDiaLibre = true;
    } else {
      switch (dia) {
        case 0: // Domingo: día libre
          inicio = "07:00";
          fin = "07:00";
          incluyeAlmuerzo = false;
          cantidadHorasLaborables = 0;
          esDiaLibre = true;
          break;
        case 6: // Sábado: 07:00–12:00 (5h, sin almuerzo)
          inicio = "07:00";
          fin = "12:00";
          incluyeAlmuerzo = false;
          cantidadHorasLaborables = 5;
          esDiaLibre = false;
          break;
        case 5: // Viernes: 07:00–16:00 (8h)
          inicio = "07:00";
          fin = "16:00";
          incluyeAlmuerzo = true;
          cantidadHorasLaborables = 8;
          esDiaLibre = false;
          break;
        default: // Lunes a Jueves: 07:00–17:00 (9h)
          inicio = "07:00";
          fin = "17:00";
          incluyeAlmuerzo = true;
          cantidadHorasLaborables = 9;
          esDiaLibre = false;
          break;
      }
    }

    return {
      tipoHorario: "H1_9",
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
    return this.calcularHorarioTrabajoSinConsultas(
      fecha,
      empleadoId,
      feriadoInfo
    );
  }
}
