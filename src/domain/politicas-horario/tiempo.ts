// ============================================================================
// infraestructura/tiempo.ts (utilidades de tiempo con dayjs)
// ============================================================================
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import tzPlugin from "dayjs/plugin/timezone";
import customParse from "dayjs/plugin/customParseFormat";

dayjs.extend(utc);
dayjs.extend(tzPlugin);
dayjs.extend(customParse);

export const TZ_DEF = "America/Tegucigalpa";
export const DIURNO_INICIO = "05:00";
export const DIURNO_FIN = "19:00";

export const d = (iso: string | Date, tz = TZ_DEF) => dayjs(iso).tz(tz);

export function unirFechaHoraLocal(
  fecha: string,
  hhmm: string,
  tz = TZ_DEF
): string {
  return d(`${fecha}T${hhmm}:00`, tz).format(); // ISO con TZ
}

export interface Intervalo {
  inicio: string; // ISO
  fin: string; // ISO
}

export function minutos(i: Intervalo): number {
  return Math.max(0, d(i.fin).diff(d(i.inicio), "minute"));
}

export function horasDesdeMin(min: number): number {
  // Exacto a centésimas: 15 min -> 0.25; 30 -> 0.5, etc.
  return Math.round((min / 60) * 100) / 100;
}

export function interseccion(a: Intervalo, b: Intervalo): Intervalo | null {
  const inicio = d(a.inicio).isAfter(d(b.inicio)) ? a.inicio : b.inicio;
  const fin = d(a.fin).isBefore(d(b.fin)) ? a.fin : b.fin;
  return d(inicio).isBefore(d(fin)) ? { inicio, fin } : null;
}

export function restar(A: Intervalo, B: Intervalo): Intervalo[] {
  const x = interseccion(A, B);
  if (!x) return [A];
  const izq: Intervalo = { inicio: A.inicio, fin: x.inicio };
  const der: Intervalo = { inicio: x.fin, fin: A.fin };
  const out: Intervalo[] = [];
  if (minutos(izq) > 0) out.push(izq);
  if (minutos(der) > 0) out.push(der);
  return out;
}

export function intervaloDia(fecha: string, tz = TZ_DEF): Intervalo {
  const i = unirFechaHoraLocal(fecha, "00:00", tz);
  const f = d(i).add(1, "day").format(); // fin real = siguiente 00:00
  return { inicio: i, fin: f };
}

export function listarFechas(
  inicioISO: string,
  finISO: string,
  tz = TZ_DEF
): string[] {
  const a = d(inicioISO, tz).startOf("day");
  const b = d(finISO, tz).startOf("day");
  const dias = b.diff(a, "day");
  const out: string[] = [];
  for (let i = 0; i <= dias; i++)
    out.push(a.add(i, "day").format("YYYY-MM-DD"));
  return out;
}

/** Segmenta un día en nocturno(00–05), diurno(05–19), nocturno(19–24) */
export function segmentosDiurnoNocturno(
  fecha: string,
  tz = TZ_DEF
): Intervalo[] {
  const N1 = {
    inicio: unirFechaHoraLocal(fecha, "00:00", tz),
    fin: unirFechaHoraLocal(fecha, DIURNO_INICIO, tz),
  };
  const D1 = {
    inicio: unirFechaHoraLocal(fecha, DIURNO_INICIO, tz),
    fin: unirFechaHoraLocal(fecha, DIURNO_FIN, tz),
  };
  const N2 = {
    inicio: unirFechaHoraLocal(fecha, DIURNO_FIN, tz),
    fin: d(unirFechaHoraLocal(fecha, "00:00", tz)).add(1, "day").format(),
  };
  return [N1, D1, N2];
}
