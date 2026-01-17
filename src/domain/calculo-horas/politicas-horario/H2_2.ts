// src/domain/calculo-horas/politicas-horario/H2_2.ts
import { PoliticaH2 } from "./H2";
import { HorarioTrabajo } from "../types";

/**
 * Política de horario H2.2 - Lunes a Viernes Copenergy
 * Horario fijo de lunes a viernes, con almuerzo (si NO es hora corrida)
 *
 * Horario:
 * - Lun–Jue: 07:00–17:00 (10h de rango; horas laborables = 9h si NO es hora corrida)
 * - Vie:     07:00–16:00 (9h de rango;  horas laborables = 8h si NO es hora corrida)
 * - Sáb–Dom: Días libres
 */
export class PoliticaH2_2 extends PoliticaH2 {
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

    const reg = await this.getRegistroDiario(empleadoId, fecha);
    const feriadoInfo = await this.esFeriado(fecha);
    const dia = new Date(`${fecha}T00:00:00`).getDay(); // 0=Dom

    let inicio = "07:00";
    let fin = "07:00";
    let cantidadHorasLaborables = 0;
    let esDiaLibre = false;
    // H2_2: almuerzo aplica cuando NO es hora corrida (misma lógica que H1_1)
    // Si no hay registro, por defecto NO es hora corrida (aplica almuerzo)
    const esHoraCorrida = reg ? Boolean(reg?.esHoraCorrida) : false;
    const incluyeAlmuerzo = !esHoraCorrida;

    // H2_2: el horario del día SIEMPRE es el generado por política (fijo por día de semana),
    // incluso si ya existe un registro diario guardado.
    //
    // Esto evita depender de horaEntrada/horaSalida guardadas en el registro para mostrar el form.
    // El registro se utiliza únicamente para leer esHoraCorrida (para descuento de almuerzo).

    // Los feriados marcan el día como "día libre"
    if (feriadoInfo.esFeriado) {
      esDiaLibre = true;
    }

    // Sábado (6) y Domingo (0) son días libres
    if (dia === 0 || dia === 6) {
      esDiaLibre = true;
    }

    if (!esDiaLibre) {
      inicio = "07:00";
      if (dia === 5) {
        // Viernes: 07:00 - 16:00
        fin = "16:00";
        // (9h rango) - 1h almuerzo cuando NO es hora corrida
        cantidadHorasLaborables = Math.max(0, 9 - (esHoraCorrida ? 0 : 1));
      } else {
        // Lunes a Jueves: 07:00 - 17:00
        fin = "17:00";
        // (10h rango) - 1h almuerzo cuando NO es hora corrida
        cantidadHorasLaborables = Math.max(0, 10 - (esHoraCorrida ? 0 : 1));
      }
    } else {
      // Día libre/festivo: mantener 07:00-07:00 (0 horas)
      inicio = "07:00";
      fin = "07:00";
      cantidadHorasLaborables = 0;
    }

    return {
      tipoHorario: "H2_2",
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
