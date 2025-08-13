// ============================================================================
// dominio/politicas-horario/H2.ts
// ============================================================================
import { PoliticaBaseHorario } from "./base";
import { FechaISO, JornadaUnica, OpcionesConteo } from "./types";
import { d, TZ_DEF } from "./tiempo";
import { FeriadoService } from "../../services/FeriadoService";

type TurnoH2 = "dia" | "noche";

/**
 * H2:
 * - Semana de por medio: el backend SIEMPRE retorna jornada (12h) y el frontend decide si aplica.
 * - Turno de día: 12h todos los días.
 * - Turno de noche: 12h excepto martes = 6h.
 * - Porcentajes: extras SOLO 25%; feriados 100% (todo lo trabajado ese día).
 */
export class PoliticaH2 extends PoliticaBaseHorario {
  constructor(private turno: TurnoH2 = "dia") {
    super();
  }

  /** Define la jornada (horas planificadas) del día */
  protected async jornadaDelDia(
    fecha: FechaISO,
    _opciones?: OpcionesConteo
  ): Promise<{
    esDiaLibre: boolean;
    esFestivo: boolean;
    jornada?: JornadaUnica;
  }> {
    // Para H2 no marcamos "día libre"; devolvemos jornada todos los días.
    const wd = d(`${fecha}T00:00:00`, TZ_DEF).day(); // 0=Dom ... 2=Mar ... 6=Sab

    // ¿Feriado?
    let esFestivo = false;
    try {
      await FeriadoService.getFeriadoByDate(fecha);
      esFestivo = true;
    } catch {
      esFestivo = false;
    }

    if (this.turno === "dia") {
      // 12h fijas (ejemplo: 07:00–19:00). Sin almuerzo por defecto.
      return {
        esDiaLibre: false,
        esFestivo,
        jornada: { inicio: "07:00", fin: "19:00" },
      };
    }

    // Turno de noche:
    if (wd === 2) {
      // Martes: 6h (ejemplo: 19:00–01:00 del siguiente día)
      return {
        esDiaLibre: false,
        esFestivo,
        jornada: { inicio: "19:00", fin: "01:00" },
      };
    }
    // Resto de días: 12h (ejemplo: 19:00–07:00)
    return {
      esDiaLibre: false,
      esFestivo,
      jornada: { inicio: "19:00", fin: "07:00" },
    };
  }

  /** Para H2 devolvemos siempre 12h (o 6h martes noche) como planificadas: el front decide si aplican. */
  async obtenerHorario(fecha: FechaISO, opciones?: OpcionesConteo) {
    const base = await this.jornadaDelDia(fecha, opciones);
    const wd = d(`${fecha}T00:00:00`, this.tz).day();

    let horasPlan = 12;
    if (this.turno === "noche" && wd === 2) horasPlan = 6;

    return {
      fecha,
      esDiaLibre: base.esDiaLibre, // en H2 siempre false, pero lo preservamos
      esFestivo: base.esFestivo,
      jornada: base.jornada, // para cruce medianoche y cómputo de normal/extras
      cantidadHorasLaborables: horasPlan, // SIEMPRE 12 (o 6 el martes de noche) -> opcional en el front
    };
  }

  /** Extras SOLO 25% (colapsamos 25/50/75), feriados 100% (ya manejado por la base). */
  async contarHoras(
    fechaInicio: string,
    fechaFin: string,
    opciones?: OpcionesConteo
  ) {
    const res = await super.contarHoras(fechaInicio, fechaFin, opciones);

    // Colapsar extras (25 + 50 + 75) -> 25; 50 y 75 = 0
    const totalExtras =
      (res.cantidadHoras.p25 ?? 0) +
      (res.cantidadHoras.p50 ?? 0) +
      (res.cantidadHoras.p75 ?? 0);
    const round = (n: number) => Math.round(n * 100) / 100;

    res.cantidadHoras.p25 = round(totalExtras);
    res.cantidadHoras.p50 = 0;
    res.cantidadHoras.p75 = 0;

    // Feriados ya van íntegros a p100 por la lógica de PoliticaBase (esLibreOFestivo).
    return res;
  }
}
