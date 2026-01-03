// src/domain/calculo-horas/politicas-horario/H2_2.ts
import { PoliticaH2 } from "./H2";
import { HorarioTrabajo } from "../types";

/**
 * Política de horario H2.2 - Lunes a Viernes Copenergy
 * Horario fijo de lunes a viernes, sin almuerzo
 *
 * Horario:
 * - Lun–Vie: 07:00–19:00 (12h, sin almuerzo)
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
    const incluyeAlmuerzo = false; // H2 jamás almuerzo

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

        // Usar método estático de la clase base para calcular horas normales
        cantidadHorasLaborables =
          (PoliticaH2_2 as any).normalesDeclaradosMin(e, s) / 60;
      } else {
        // Lunes a Viernes sin registro: horario por defecto
        inicio = "07:00";
        fin = "19:00";
        cantidadHorasLaborables = 12;
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
