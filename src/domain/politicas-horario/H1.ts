// ============================================================================
// dominio/politicas/PoliticaH1.ts
// ============================================================================
import { PoliticaBaseHorario } from "./base";
import { FechaISO, JornadaUnica, OpcionesConteo } from "./types";
import { d, TZ_DEF } from "./tiempo";
import { FeriadoService } from "../../services/FeriadoService";

export class PoliticaH1 extends PoliticaBaseHorario {
  /** Jornada L–J 9h; V 8h; S sin jornada (laboral); D libre. */
  protected async jornadaDelDia(
    fecha: FechaISO,
    _opciones?: OpcionesConteo
  ): Promise<{
    esDiaLibre: boolean;
    esFestivo: boolean;
    jornada?: JornadaUnica;
  }> {
    const wd = d(`${fecha}T00:00:00`, TZ_DEF).day(); // 0=Dom, 1=Lun ... 6=Sab

    // Domingo: día libre
    if (wd === 0) {
      return { esDiaLibre: true, esFestivo: false };
    }

    // ¿Es feriado?
    let esFestivo = false;
    try {
      await FeriadoService.getFeriadoByDate(fecha);
      esFestivo = true;
    } catch {
      esFestivo = false;
    }

    // Lunes–Jueves: 07:00–17:00 con almuerzo 12:00–13:00 (9h netas)
    if (wd >= 1 && wd <= 4) {
      return {
        esDiaLibre: false,
        esFestivo,
        jornada: {
          inicio: "07:00",
          fin: "17:00",
          almuerzo: { inicio: "12:00", fin: "13:00" },
        },
      };
    }

    // Viernes: 07:00–16:00 con almuerzo 12:00–13:00 (8h netas)
    if (wd === 5) {
      return {
        esDiaLibre: false,
        esFestivo,
        jornada: {
          inicio: "07:00",
          fin: "16:00",
          almuerzo: { inicio: "12:00", fin: "13:00" },
        },
      };
    }

    // Sábado: día laboral sin jornada (0 horas planificadas)
    if (wd === 6) {
      return { esDiaLibre: false, esFestivo, jornada: undefined };
    }

    // Fallback (no debería llegar aquí)
    return { esDiaLibre: false, esFestivo, jornada: undefined };
  }
}
