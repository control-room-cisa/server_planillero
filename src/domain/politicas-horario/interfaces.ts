// ============================================================================
// dominio/interfaces.ts
// ============================================================================
import {
  FechaISO,
  FechaHoraISO,
  HorarioDelDia,
  OpcionesConteo,
  ResultadoConteo,
} from "./types";

export interface IPoliticaHorario {
  obtenerHorario(
    fecha: FechaISO,
    opciones?: OpcionesConteo
  ): Promise<HorarioDelDia>;
  contarHoras(
    fechaInicio: FechaHoraISO,
    fechaFin: FechaHoraISO,
    opciones?: OpcionesConteo
  ): Promise<ResultadoConteo>;
}
