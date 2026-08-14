const DEFAULT_TZ = "America/Tegucigalpa";
const EPS_MIN = 1;

export const VACACIONES_DIA_COMPLETO_MIN = 8 * 60;
export const VACACIONES_MEDIO_DIA_MIN = 4 * 60;

function minutesOfDayInTZ(d: Date, tz = DEFAULT_TZ): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: tz,
  }).formatToParts(d);
  const hh = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const mm = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hh * 60 + mm;
}

/**
 * Horas laborables del registro (misma idea que el timesheet):
 * span entrada–salida menos almuerzo, si aplica.
 */
export function minutosLaborablesDesdeRegistro(params: {
  horaEntrada?: Date | string | null;
  horaSalida?: Date | string | null;
  restarAlmuerzoMin?: number;
}): number {
  if (!params.horaEntrada || !params.horaSalida) return 0;
  const e = new Date(params.horaEntrada);
  const s = new Date(params.horaSalida);
  if (Number.isNaN(e.getTime()) || Number.isNaN(s.getTime())) return 0;

  const em = minutesOfDayInTZ(e);
  const sm = minutesOfDayInTZ(s);
  if (em === sm) return 0;
  const span = em < sm ? sm - em : sm + (24 * 60 - em);
  return Math.max(0, span - (params.restarAlmuerzoMin ?? 0));
}

/**
 * Día completo (ocupación ≈ horas laborables) → 8h.
 * Medio día (ocupación ≈ horas laborables / 2) → 4h.
 * Cualquier otro valor (registros viejos) se deja tal cual.
 */
export function reinterpretE02VacacionesMin(
  ocupacionMin: number,
  minutosLaborables: number
): number {
  if (!Number.isFinite(ocupacionMin) || ocupacionMin <= 0) return 0;
  if (!Number.isFinite(minutosLaborables) || minutosLaborables <= 0) {
    return ocupacionMin;
  }

  const mediaMin = Math.round(minutosLaborables / 2);
  if (Math.abs(ocupacionMin - minutosLaborables) <= EPS_MIN) {
    return VACACIONES_DIA_COMPLETO_MIN;
  }
  if (Math.abs(ocupacionMin - mediaMin) <= EPS_MIN) {
    return VACACIONES_MEDIO_DIA_MIN;
  }
  return ocupacionMin;
}

export function horasE02Contables(
  duracionHoras: number,
  registro: {
    horaEntrada?: Date | string | null;
    horaSalida?: Date | string | null;
  },
  restarAlmuerzoMin: number
): number {
  const ocupacionMin = Math.round(Number(duracionHoras) * 60);
  if (!Number.isFinite(ocupacionMin) || ocupacionMin <= 0) return 0;
  const minutosLaborables = minutosLaborablesDesdeRegistro({
    horaEntrada: registro.horaEntrada,
    horaSalida: registro.horaSalida,
    restarAlmuerzoMin,
  });
  const contableMin = reinterpretE02VacacionesMin(
    ocupacionMin,
    minutosLaborables
  );
  return Math.round((contableMin / 60) * 100) / 100;
}
