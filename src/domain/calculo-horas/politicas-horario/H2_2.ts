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

    // Los feriados marcan el día como "día libre"
    if (feriadoInfo.esFeriado) {
      esDiaLibre = true;
    } else {
      // Sábado (6) y Domingo (0) son días libres
      if (dia === 0 || dia === 6) {
        esDiaLibre = true;
      } else if (reg) {
        // Lunes a Viernes: usar horario registrado
        const e = new Date(reg.horaEntrada);
        const s = new Date(reg.horaSalida);
        const toHHMM = (d: Date) => d.toTimeString().slice(0, 5);
        inicio = toHHMM(e);
        fin = toHHMM(s);

        // Calcular horas: (salida - entrada) - 1h almuerzo si NO es hora corrida.
        const baseHoras =
          (PoliticaH2_2 as any).normalesDeclaradosMin(e, s) / 60;
        cantidadHorasLaborables = Math.max(
          0,
          baseHoras - (esHoraCorrida ? 0 : 1)
        );
      } else {
        // Lunes a Viernes sin registro: horario por defecto
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
      }
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
