// src/domain/calculo-horas/politicas-horario/H1_10.ts
import { PoliticaH1 } from "./H1";
import { HorarioTrabajo } from "../types";

/**
 * Política de horario H1.10 - Horario libre UI
 *
 * Sin plantilla predefinida: el backend no propone horas laborables.
 * Entrada/salida, jornada, día libre, hora corrida, etc. se definen en el frontend
 * y se persisten en el registro diario.
 *
 * - Sin registro: 07:00–07:00 (0h), sin almuerzo
 * - Feriado: día libre + 0h
 */
export class PoliticaH1_10 extends PoliticaH1 {
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

    return {
      tipoHorario: "H1_10",
      fecha,
      empleadoId,
      horarioTrabajo: { inicio: "07:00", fin: "07:00" },
      incluyeAlmuerzo: false,
      esDiaLibre: feriadoInfo.esFeriado,
      esFestivo: feriadoInfo.esFeriado,
      nombreDiaFestivo: feriadoInfo.nombre,
      cantidadHorasLaborables: 0,
    };
  }
}
