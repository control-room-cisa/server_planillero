// src/domain/calculo-horas/politicas-horario/H2_1.ts
import { PoliticaH2 } from "./H2";
import { HorarioTrabajo } from "../types";

/**
 * Política de horario H2.1 - Turnos 7x7 Copenergy
 * Turnos rotativos de 12 horas, sin almuerzo
 *
 * Horario:
 * - Turno diurno: 07:00–19:00 (12h, sin almuerzo)
 * - Turno nocturno: 19:00–07:00 (12h, sin almuerzo)
 * - Regla especial: Martes nocturno tiene 6h normales (cambio de turno)
 */
export class PoliticaH2_1 extends PoliticaH2 {
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
    const esDiaLibre = reg?.esDiaLibre || false;

    let inicio = "07:00";
    let fin = "19:00";
    let cantidadHorasLaborables = 12;
    const incluyeAlmuerzo = false; // H2 jamás almuerzo

    if (reg) {
      const e = new Date(reg.horaEntrada);
      const s = new Date(reg.horaSalida);
      const toHHMM = (d: Date) => d.toTimeString().slice(0, 5);
      inicio = toHHMM(e);
      fin = toHHMM(s);

      // Usar método estático de la clase base para calcular horas normales
      cantidadHorasLaborables =
        (PoliticaH2_1 as any).normalesDeclaradosMin(e, s) / 60;
    }

    return {
      tipoHorario: "H2_1",
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
