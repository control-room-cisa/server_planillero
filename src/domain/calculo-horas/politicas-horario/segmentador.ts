/**
 * SEGMENTADOR DE JORNADA (15 min)
 * ---------------------------------------------------------------------------
 * Reglas implementadas (con validación y comentarios inline):
 *
 * 1) Cobertura total del día:
 *    - Se generan 96 slots de 15 min para cubrir 00:00–24:00.
 *
 * 2) Tipos de segmentos:
 *    - NORMAL (incluye job/descripcion si proviene de actividad dentro de RANGO NORMAL)
 *    - ALMUERZO (12:00–13:00) solo si esHoraCorrida === false y 12–13 cae dentro del RANGO NORMAL.
 *    - EXTRA   (obligatoriamente fuera del RANGO NORMAL o si la actividad va marcada como extra)
 *    - LIBRE
 *
 * 3) Definición de RANGO NORMAL:
 *    - Si horaEntrada < horaSalida → [Entrada, Salida).
 *    - Si horaEntrada > horaSalida → cruza medianoche → [00:00, Salida) y [Entrada, 24:00).
 *    - Si Entrada == Salida → 0 h normales (día sin rango normal).
 *    - Todo dentro del MISMO día.
 *
 * 4) ALMUERZO:
 *    - Solo se pinta 12:00–13:00 si:
 *      a) esHoraCorrida === false y
 *      b) 12:00–13:00 está COMPLETAMENTE dentro del RANGO NORMAL.
 *    - Nunca se pinta almuerzo en horas EXTRA.
 *    - Si el RANGO NORMAL no cubre 12–13 y no es hora corrida → se reporta error ALMUERZO_NO_APLICA_POR_RANGO.
 *
 * 5) NORMAL vs EXTRA:
 *    - NORMAL: solo dentro de RANGO NORMAL (y no sobre ALMUERZO).
 *    - EXTRA: toda actividad fuera del RANGO NORMAL, o marcada esExtra=true, se pinta como EXTRA.
 *
 * 6) Validaciones (todas agregan items al arreglo `errores[]`):
 *    - EXTRA_DENTRO_DE_NORMAL:
 *        No debe existir EXTRA solapado con RANGO NORMAL (regla dura).
 *    - NORMAL_FUERA_DE_RANGO:
 *        No debe existir NORMAL fuera de RANGO NORMAL.
 *    - ALMUERZO_FUERA_DE_NORMAL:
 *        Si almuerzo fue aplicado, debe estar completamente dentro de RANGO NORMAL.
 *    - ALMUERZO_NO_APLICA_POR_RANGO:
 *        Si no es hora corrida y 12–13 no está cubierto por RANGO NORMAL, no corresponde almuerzo.
 *    - SUMA_NORMAL_MAS_ALMUERZO_NO_COINCIDE (regla dura):
 *        minutos(RANGO NORMAL) == minutos(NORMAL) + minutos(ALMUERZO).
 *
 * 7) Compactación de segmentos:
 *    - Se unen slots contiguos con mismo (tipo, jobId, descripcion).
 *    - Se respetan cortes OBLIGATORIOS en 05:00 y 19:00 para separar diurno/nocturno.
 *
 * 8) Orden:
 *    - Los segmentos finales se devuelven ordenados cronológicamente 00:00→24:00.
 *
 * 9) Zona horaria:
 *    - Las HH:mm de DateTime se extraen con Intl en "America/Tegucigalpa" por defecto.
 *
 * 10) Datos del modelo:
 *    - Horas EXTRA SIEMPRE incluyen horaInicio/horaFin en actividades.
 *    - HORAS NORMALES no requieren horaInicio/horaFin explícitas (derivan de Entrada/Salida).
 *
 * Salida:
 *    - { segmentos, errores, totales }
 *      donde `errores` es un arreglo de ValidacionError para que la API pueda responder 422 si corresponde.
 */

export type TipoSegmento = "NORMAL" | "ALMUERZO" | "EXTRA" | "LIBRE";

export interface Segmento15 {
  inicio: string; // 'HH:mm' (inclusive)
  fin: string; // 'HH:mm' (exclusive; puede ser '24:00')
  tipo: TipoSegmento;
  jobId?: number;
  jobCodigo?: string | null;
  jobNombre?: string | null;
  descripcion?: string | null;
}

export interface RegistroDiarioLike {
  fecha: string; // 'YYYY-MM-DD'
  horaEntrada: Date; // DateTime (DB) del día
  horaSalida: Date; // DateTime (DB) del día
  esHoraCorrida?: boolean | null;
  esDiaLibre?: boolean | null;
  actividades?: ActividadLike[];
}

export interface ActividadLike {
  horaInicio?: Date | null; // obligatorio para EXTRA
  horaFin?: Date | null; // obligatorio para EXTRA
  esExtra?: boolean | null;
  descripcion: string | null;
  job?: { id: number; codigo?: string | null; nombre?: string | null } | null;
  jobId?: number | null;
}

export interface ValidacionError {
  code:
    | "EXTRA_DENTRO_DE_NORMAL"
    | "ALMUERZO_FUERA_DE_NORMAL"
    | "SUMA_NORMAL_MAS_ALMUERZO_NO_COINCIDE"
    | "ALMUERZO_NO_APLICA_POR_RANGO"
    | "NORMAL_FUERA_DE_RANGO";
  message: string;
  detalle?: any;
  severity?: "ERROR" | "WARN";
}

export interface ResultadoSegmentacion {
  segmentos: Segmento15[];
  errores: ValidacionError[];
  totales: {
    minutosRangoNormal: number;
    minutosNormal: number;
    minutosAlmuerzo: number;
    minutosExtra: number;
    minutosLibre: number;
  };
}

// ----------------------- utilidades de tiempo -----------------------
const SLOT_MIN = 15;
const DAY_MIN = 24 * 60;
const DEFAULT_TZ = "America/Tegucigalpa";
const CORTES_OBLIGATORIOS = [5 * 60, 19 * 60]; // 05:00 y 19:00

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}
function minToHHMM(min: number): string {
  if (min === DAY_MIN) return "24:00";
  const h = Math.floor(min / 60),
    m = min % 60;
  return `${pad(h)}:${pad(m)}`;
}
function hhmmToMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// Convierte Date → minutos del día en TZ dada
function minutesOfDayInTZ(d: Date, tz: string): number {
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

type Rango = [number, number]; // [minInicio, minFin) con 0 <= minInicio < minFin <= 1440

function rangoNormalDesdeEntradaSalida(
  entradaMin: number,
  salidaMin: number
): Rango[] {
  if (entradaMin === salidaMin) return []; // 0h normales
  if (entradaMin < salidaMin) return [[entradaMin, salidaMin]];
  // cruza medianoche: [00, salida) + [entrada, 24)
  return [
    [0, salidaMin],
    [entradaMin, DAY_MIN],
  ];
}

function clampToDay(r: Rango): Rango[] {
  const a = Math.max(0, r[0]),
    b = Math.min(DAY_MIN, r[1]);
  return a < b ? [[a, b]] : [];
}

function splitIfWrap(startMin: number, endMin: number): Rango[] {
  if (startMin < endMin) return [[startMin, endMin]];
  return [
    [0, endMin],
    [startMin, DAY_MIN],
  ];
}

function indicesPorRango(r: Rango): [number, number] {
  const i0 = Math.floor(r[0] / SLOT_MIN);
  const i1 = Math.ceil(r[1] / SLOT_MIN);
  return [Math.max(0, i0), Math.min(96, i1)];
}

function rangoDentroDeAlguno(target: Rango, contenedores: Rango[]): boolean {
  return contenedores.some(([a, b]) => target[0] >= a && target[1] <= b);
}

function intersect(a: Rango, b: Rango): Rango | null {
  const s = Math.max(a[0], b[0]),
    e = Math.min(a[1], b[1]);
  return s < e ? [s, e] : null;
}

function intersecciones(a: Rango[], b: Rango[]): Rango[] {
  const out: Rango[] = [];
  for (const ra of a)
    for (const rb of b) {
      const r = intersect(ra, rb);
      if (r) out.push(r);
    }
  return out;
}

function sumMinutes(rangos: Rango[]): number {
  return rangos.reduce((acc, [a, b]) => acc + (b - a), 0);
}

function splitSegmentAtBoundaries(
  seg: Segmento15,
  mins: number[]
): Segmento15[] {
  const a0 = hhmmToMin(seg.inicio);
  const b0 = hhmmToMin(seg.fin);
  const cuts = mins.filter((m) => m > a0 && m < b0).sort((x, y) => x - y);
  const parts: Segmento15[] = [];
  let last = a0;
  for (const c of cuts) {
    parts.push({ ...seg, inicio: minToHHMM(last), fin: minToHHMM(c) });
    last = c;
  }
  parts.push({ ...seg, inicio: minToHHMM(last), fin: minToHHMM(b0) });
  return parts.filter((p) => hhmmToMin(p.inicio) < hhmmToMin(p.fin));
}

function ordenarHHMM(a: Segmento15, b: Segmento15): number {
  return (
    hhmmToMin(a.inicio) - hhmmToMin(b.inicio) ||
    hhmmToMin(a.fin) - hhmmToMin(b.fin)
  );
}

// --------------------- segmentación principal ----------------------

export function segmentarRegistroDiario(
  registro: RegistroDiarioLike,
  opts?: { tz?: string }
): ResultadoSegmentacion {
  const tz = opts?.tz ?? DEFAULT_TZ;
  const errores: ValidacionError[] = [];

  // 1) Inicializar 96 slots como LIBRE
  const slots: Array<{
    tipo: TipoSegmento;
    jobId?: number;
    jobCodigo?: string | null;
    jobNombre?: string | null;
    descripcion?: string | null;
  }> = Array.from({ length: 96 }, () => ({ tipo: "LIBRE" }));

  // 2) Calcular RANGO NORMAL (Entrada/Salida) salvo día libre
  const entradaMin = minutesOfDayInTZ(registro.horaEntrada, tz);
  const salidaMin = minutesOfDayInTZ(registro.horaSalida, tz);
  const rangosNormal: Rango[] = registro.esDiaLibre
    ? []
    : rangoNormalDesdeEntradaSalida(entradaMin, salidaMin);

  // Pinta NORMAL por defecto en RANGO NORMAL
  for (const r of rangosNormal) {
    const [i0, i1] = indicesPorRango(r);
    for (let i = i0; i < i1; i++) slots[i].tipo = "NORMAL";
  }

  // 3) ALMUERZO (12:00–13:00) — debe caer COMPLETO dentro de RANGO NORMAL y no ser hora corrida
  const R_ALMUERZO: Rango = [hhmmToMin("12:00"), hhmmToMin("13:00")];
  const almuerzoDentro = rangoDentroDeAlguno(R_ALMUERZO, rangosNormal);
  const aplicaAlmuerzo = !registro.esHoraCorrida && almuerzoDentro;

  if (!aplicaAlmuerzo && !registro.esHoraCorrida) {
    if (!almuerzoDentro && rangosNormal.length > 0) {
      errores.push({
        code: "ALMUERZO_NO_APLICA_POR_RANGO",
        message:
          "El rango Entrada–Salida no cubre 12:00–13:00; no se debe contar almuerzo.",
        detalle: {
          rangosNormal: rangosNormal.map((r) => [
            minToHHMM(r[0]),
            minToHHMM(r[1]),
          ]),
        },
        severity: "ERROR",
      });
    }
  }

  if (aplicaAlmuerzo) {
    const [i0, i1] = indicesPorRango(R_ALMUERZO);
    for (let i = i0; i < i1; i++) {
      if (slots[i].tipo === "NORMAL") slots[i] = { tipo: "ALMUERZO" };
    }
  }

  // 4) ACTIVIDADES → pintan EXTRA (fuera de normal o esExtra=true) o NORMAL (dentro de normal)
  const actividades = registro.actividades ?? [];
  const rangosExtraPintados: Rango[] = []; // para validar EXTRA dentro de NORMAL

  for (const act of actividades) {
    if (!act.horaInicio || !act.horaFin) continue; // ignorar mal definidas (EXTRA debe traer horas)

    const start = minutesOfDayInTZ(act.horaInicio, tz);
    const end = minutesOfDayInTZ(act.horaFin, tz);

    const rangosAct = splitIfWrap(start, end).flatMap(clampToDay);
    for (const r of rangosAct) {
      const [i0, i1] = indicesPorRango(r);
      for (let i = i0; i < i1; i++) {
        const centro = i * SLOT_MIN + SLOT_MIN / 2;
        const enNormal = rangosNormal.some(
          ([a, b]) => centro >= a && centro < b
        );
        const seraExtra = !!act.esExtra || !enNormal;

        if (seraExtra) {
          // EXTRA sobrepone todo, incluso almuerzo (y se valida después)
          slots[i] = {
            tipo: "EXTRA",
            jobId: act.job?.id ?? act.jobId ?? undefined,
            jobCodigo: act.job?.codigo ?? null,
            jobNombre: act.job?.nombre ?? null,
            descripcion: act.descripcion ?? null,
          };
        } else {
          // NORMAL con job/descr., pero no sobreescribe ALMUERZO
          if (slots[i].tipo !== "ALMUERZO") {
            slots[i] = {
              tipo: "NORMAL",
              jobId: act.job?.id ?? act.jobId ?? undefined,
              jobCodigo: act.job?.codigo ?? null,
              jobNombre: act.job?.nombre ?? null,
              descripcion: act.descripcion ?? null,
            };
          }
        }
      }

      // Guardar rango pintado como EXTRA (para validar) si aplica
      const esExtraGlobal =
        !!act.esExtra || !rangoDentroDeAlguno(r, rangosNormal);
      if (esExtraGlobal) rangosExtraPintados.push(r);
    }
  }

  // 5) Compactar por (tipo, jobId, descripcion)
  const compactados: Segmento15[] = [];
  let currStart = 0;
  let curr = slots[0];

  const pushSeg = (finIndexExcl: number) => {
    compactados.push({
      inicio: minToHHMM(currStart * SLOT_MIN),
      fin: minToHHMM(finIndexExcl * SLOT_MIN),
      tipo: curr.tipo,
      jobId: curr.jobId,
      jobCodigo: curr.jobCodigo ?? undefined,
      jobNombre: curr.jobNombre ?? undefined,
      descripcion: curr.descripcion ?? undefined,
    });
  };

  for (let i = 1; i < slots.length; i++) {
    const s = slots[i];
    const same =
      s.tipo === curr.tipo &&
      s.jobId === curr.jobId &&
      (s.descripcion ?? null) === (curr.descripcion ?? null);
    if (!same) {
      pushSeg(i);
      currStart = i;
      curr = s;
    }
  }
  pushSeg(96);

  // 6) Cortes obligatorios en 05:00 y 19:00 (separan diurno/nocturno)
  const conCortes: Segmento15[] = compactados.flatMap((seg) =>
    splitSegmentAtBoundaries(seg, CORTES_OBLIGATORIOS)
  );

  // 7) Orden final por hora
  conCortes.sort(ordenarHHMM);

  // 8) VALIDACIONES

  // a) EXTRA dentro de RANGO NORMAL ⇒ ERROR
  const interExtraNormal = intersecciones(rangosExtraPintados, rangosNormal);
  if (interExtraNormal.length > 0) {
    errores.push({
      code: "EXTRA_DENTRO_DE_NORMAL",
      message: "Se detectaron horas EXTRA dentro del rango de horas NORMALES.",
      detalle: interExtraNormal.map((r) => ({
        inicio: minToHHMM(r[0]),
        fin: minToHHMM(r[1]),
      })),
      severity: "ERROR",
    });
  }

  // b) ALMUERZO fuera de RANGO NORMAL ⇒ ERROR (si fue aplicado)
  if (aplicaAlmuerzo && !rangoDentroDeAlguno(R_ALMUERZO, rangosNormal)) {
    errores.push({
      code: "ALMUERZO_FUERA_DE_NORMAL",
      message:
        "El almuerzo (12:00–13:00) no cae completamente dentro del rango NORMAL.",
      detalle: {
        almuerzo: ["12:00", "13:00"],
        rangosNormal: rangosNormal.map((r) => [
          minToHHMM(r[0]),
          minToHHMM(r[1]),
        ]),
      },
      severity: "ERROR",
    });
  }

  // c) NORMAL fuera de RANGO NORMAL ⇒ ERROR
  const rangosNormalSegmentos = conCortes
    .filter((s) => s.tipo === "NORMAL")
    .map<Rango>((s) => [hhmmToMin(s.inicio), hhmmToMin(s.fin)]);

  const fuera = rangosNormalSegmentos.flatMap((r) => {
    const recortes = rangosNormal
      .map((nr) => intersect(r, nr))
      .filter(Boolean) as Rango[];
    const minsRecortados = sumMinutes(recortes);
    return minsRecortados < r[1] - r[0] ? [r] : [];
  });

  if (fuera.length > 0) {
    errores.push({
      code: "NORMAL_FUERA_DE_RANGO",
      message:
        "Se detectaron segmentos NORMAL fuera del rango de horas NORMALES.",
      detalle: fuera.map((r) => ({
        inicio: minToHHMM(r[0]),
        fin: minToHHMM(r[1]),
      })),
      severity: "ERROR",
    });
  }

  // d) Invariante de cuadre: minutos(RANGO NORMAL) == minutos(NORMAL) + minutos(ALMUERZO)
  const minutosRangoNormal = sumMinutes(rangosNormal);
  const minutosNormal = conCortes
    .filter((s) => s.tipo === "NORMAL")
    .reduce((acc, s) => acc + (hhmmToMin(s.fin) - hhmmToMin(s.inicio)), 0);
  const minutosAlmuerzo = conCortes
    .filter((s) => s.tipo === "ALMUERZO")
    .reduce((acc, s) => acc + (hhmmToMin(s.fin) - hhmmToMin(s.inicio)), 0);

  if (minutosRangoNormal !== minutosNormal + minutosAlmuerzo) {
    errores.push({
      code: "SUMA_NORMAL_MAS_ALMUERZO_NO_COINCIDE",
      message:
        "La suma de minutos de NORMAL + ALMUERZO no coincide con el rango NORMAL declarado (Entrada–Salida).",
      detalle: { minutosRangoNormal, minutosNormal, minutosAlmuerzo },
      severity: "ERROR",
    });
  }

  // Totales informativos
  const minutosExtra = conCortes
    .filter((s) => s.tipo === "EXTRA")
    .reduce((acc, s) => acc + (hhmmToMin(s.fin) - hhmmToMin(s.inicio)), 0);

  const minutosLibre = conCortes
    .filter((s) => s.tipo === "LIBRE")
    .reduce((acc, s) => acc + (hhmmToMin(s.fin) - hhmmToMin(s.inicio)), 0);

  return {
    segmentos: conCortes,
    errores,
    totales: {
      minutosRangoNormal,
      minutosNormal,
      minutosAlmuerzo,
      minutosExtra,
      minutosLibre,
    },
  };
}
