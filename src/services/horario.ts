// ============================================================================
// aplicacion/ServicioHorario.ts
// ============================================================================
import {
  EmpleadoRef,
  FechaISO,
  FechaHoraISO,
  HorarioDelDia,
  OpcionesConteo,
  ResultadoConteo,
} from "../domain/politicas-horario/types";
import { FabricaPoliticas } from "../domain/politicas-horario/fabrica-politicas";

export class ServicioHorario {
  async obtenerHorario(
    empleado: EmpleadoRef,
    fecha: FechaISO,
    opciones?: OpcionesConteo
  ): Promise<HorarioDelDia> {
    const p = FabricaPoliticas.paraEmpleado(empleado);
    return p.obtenerHorario(fecha, opciones);
  }

  async contarHoras(
    empleado: EmpleadoRef,
    fechaInicio: FechaHoraISO,
    fechaFin: FechaHoraISO,
    opciones?: OpcionesConteo
  ): Promise<ResultadoConteo> {
    const p = FabricaPoliticas.paraEmpleado(empleado);
    return p.contarHoras(fechaInicio, fechaFin, opciones);
  }
}
