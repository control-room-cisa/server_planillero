/**
 * Lógica de quincenas A/B configurable (días de corte).
 * Base contable 15 no vive aquí; solo calendario y códigos YYYYMMP.
 */

export type CorteQuincena = {
  /** Día de inicio (1–31). */
  diaInicio: number;
  /** Día de fin (1–31), o 0 = último día del mes. */
  diaFin: number;
};

export type PeriodosNominaConfig = {
  a: CorteQuincena;
  b: CorteQuincena;
};

export type IntervaloNomina = {
  fechaInicio: string; // YYYY-MM-DD
  fechaFin: string;
  letra: "A" | "B";
  label?: string;
};

export const DEFAULT_PERIODOS_NOMINA_CONFIG: PeriodosNominaConfig = {
  a: { diaInicio: 27, diaFin: 11 },
  b: { diaInicio: 12, diaFin: 26 },
};

export function cruzaMes(corte: CorteQuincena): boolean {
  return corte.diaFin !== 0 && corte.diaInicio > corte.diaFin;
}

export function lastDayOfMonth(año: number, mes0: number): number {
  return new Date(año, mes0 + 1, 0).getDate();
}

export function toYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseYmdLocal(iso: string): Date {
  const s = iso.length >= 10 ? iso.slice(0, 10) : iso;
  return new Date(`${s}T00:00:00`);
}

function resolveDiaFin(año: number, mes0: number, diaFinConfig: number): number {
  if (diaFinConfig === 0) return lastDayOfMonth(año, mes0);
  return diaFinConfig;
}

function assertCorte(name: string, corte: CorteQuincena): void {
  if (!Number.isInteger(corte.diaInicio) || corte.diaInicio < 1 || corte.diaInicio > 31) {
    throw new Error(`${name}.diaInicio inválido: ${corte.diaInicio}`);
  }
  if (
    !Number.isInteger(corte.diaFin) ||
    corte.diaFin < 0 ||
    corte.diaFin > 31
  ) {
    throw new Error(`${name}.diaFin inválido: ${corte.diaFin}`);
  }
}

export function assertPeriodosNominaConfig(config: PeriodosNominaConfig): void {
  assertCorte("A", config.a);
  assertCorte("B", config.b);
}

/**
 * Construye el intervalo A o B del mes de nómina (mes de la fecha fin / código).
 * @param mesNomina 1–12
 */
export function construirIntervalo(
  año: number,
  mesNomina: number,
  letra: "A" | "B",
  config: PeriodosNominaConfig,
): IntervaloNomina {
  assertPeriodosNominaConfig(config);
  if (mesNomina < 1 || mesNomina > 12) {
    throw new Error(`mesNomina inválido: ${mesNomina}`);
  }
  const corte = letra === "A" ? config.a : config.b;
  const mes0 = mesNomina - 1;
  const diaFin = resolveDiaFin(año, mes0, corte.diaFin);
  const fin = new Date(año, mes0, diaFin);
  const inicio = cruzaMes(corte)
    ? new Date(año, mes0 - 1, corte.diaInicio)
    : new Date(año, mes0, corte.diaInicio);

  return {
    fechaInicio: toYmdLocal(inicio),
    fechaFin: toYmdLocal(fin),
    letra,
  };
}

function finCoincideConCorte(fin: Date, corte: CorteQuincena): boolean {
  if (corte.diaFin === 0) {
    return fin.getDate() === lastDayOfMonth(fin.getFullYear(), fin.getMonth());
  }
  return fin.getDate() === corte.diaFin;
}

function matchesCorte(inicio: Date, fin: Date, corte: CorteQuincena): boolean {
  if (inicio.getDate() !== corte.diaInicio) return false;
  return finCoincideConCorte(fin, corte);
}

/**
 * Clasifica un rango como A o B según días de corte.
 */
export function clasificarPeriodo(
  fechaInicio: string | Date,
  fechaFin: string | Date,
  config: PeriodosNominaConfig,
): "A" | "B" {
  assertPeriodosNominaConfig(config);
  const inicio =
    typeof fechaInicio === "string" ? parseYmdLocal(fechaInicio) : fechaInicio;
  const fin = typeof fechaFin === "string" ? parseYmdLocal(fechaFin) : fechaFin;

  if (matchesCorte(inicio, fin, config.a)) return "A";
  if (matchesCorte(inicio, fin, config.b)) return "B";

  // Coincidencia parcial por día de fin / inicio (datos legacy ligeramente descentrados)
  if (finCoincideConCorte(fin, config.a) || inicio.getDate() === config.a.diaInicio) {
    return "A";
  }
  if (finCoincideConCorte(fin, config.b) || inicio.getDate() === config.b.diaInicio) {
    return "B";
  }

  // Fallback: comparar con día fin de A (si A no usa EOM)
  if (config.a.diaFin !== 0 && fin.getDate() <= config.a.diaFin) return "A";
  return "B";
}

/** Código YYYYMMP a partir de fechas (mes/año = fecha fin). */
export function generarCodigoNomina(
  fechaInicio: string | Date,
  fechaFin: string | Date,
  config: PeriodosNominaConfig,
): string {
  const fin = typeof fechaFin === "string" ? parseYmdLocal(fechaFin) : fechaFin;
  const letra = clasificarPeriodo(fechaInicio, fechaFin, config);
  const año = fin.getFullYear();
  const mes = String(fin.getMonth() + 1).padStart(2, "0");
  return `${año}${mes}${letra}`;
}

export function etiquetaQuincenaAB(
  fin: Date,
  config: PeriodosNominaConfig,
): "A" | "B" {
  if (finCoincideConCorte(fin, config.a)) return "A";
  if (finCoincideConCorte(fin, config.b)) return "B";
  if (config.a.diaFin !== 0 && fin.getDate() <= config.a.diaFin) return "A";
  return "B";
}

const MESES_LARGOS_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

export function getNombrePeriodoNomina(
  fechaInicio: string,
  fechaFin: string,
  config: PeriodosNominaConfig,
): string {
  const fin = parseYmdLocal(fechaFin);
  const letra = clasificarPeriodo(fechaInicio, fechaFin, config);
  const mesFin = MESES_LARGOS_ES[fin.getMonth()];
  const añoFin = fin.getFullYear();
  const cual = letra === "A" ? "Primera" : "Segunda";
  return `${cual} quincena de ${mesFin} de ${añoFin}`;
}

function formatearFechaCorta(fecha: Date): string {
  const dia = fecha.getDate().toString().padStart(2, "0");
  const mes = (fecha.getMonth() + 1).toString().padStart(2, "0");
  const yy = String(fecha.getFullYear() % 100).padStart(2, "0");
  return `${dia}/${mes}/${yy}`;
}

/**
 * Intervalos A/B del año (atribuido por fecha fin).
 * Si `año` es el actual, incluye cerrados y el en curso.
 */
export function construirIntervalosParaAño(
  año: number,
  config: PeriodosNominaConfig,
  hoy: Date = new Date(),
): Array<IntervaloNomina & { label: string; valor: string }> {
  assertPeriodosNominaConfig(config);
  const hoyNorm = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const esAñoActual = año === hoyNorm.getFullYear();
  const intervalos: Array<IntervaloNomina & { label: string; valor: string }> =
    [];

  const incluir = (inicio: Date, fin: Date) => {
    if (!esAñoActual) return true;
    return fin <= hoyNorm || (hoyNorm >= inicio && hoyNorm <= fin);
  };

  for (let mesNomina = 1; mesNomina <= 12; mesNomina++) {
    for (const letra of ["B", "A"] as const) {
      const it = construirIntervalo(año, mesNomina, letra, config);
      const inicio = parseYmdLocal(it.fechaInicio);
      const fin = parseYmdLocal(it.fechaFin);
      if (!incluir(inicio, fin)) continue;
      intervalos.push({
        ...it,
        label: `${formatearFechaCorta(inicio)} - ${formatearFechaCorta(fin)} ${letra}`,
        valor: `${it.fechaInicio}_${it.fechaFin}`,
      });
    }
  }

  intervalos.sort((a, b) =>
    a.fechaFin < b.fechaFin ? 1 : a.fechaFin > b.fechaFin ? -1 : 0,
  );
  return intervalos;
}

/** Período (A o B) que contiene una fecha calendario. */
export function periodoQueContiene(
  fecha: Date,
  config: PeriodosNominaConfig,
): IntervaloNomina | null {
  assertPeriodosNominaConfig(config);
  const y = fecha.getFullYear();
  const m = fecha.getMonth() + 1;
  const candidates: IntervaloNomina[] = [];

  for (const delta of [-1, 0, 1]) {
    let año = y;
    let mes = m + delta;
    if (mes < 1) {
      mes = 12;
      año -= 1;
    } else if (mes > 12) {
      mes = 1;
      año += 1;
    }
    candidates.push(construirIntervalo(año, mes, "A", config));
    candidates.push(construirIntervalo(año, mes, "B", config));
  }

  const t = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  for (const c of candidates) {
    const ini = parseYmdLocal(c.fechaInicio);
    const fin = parseYmdLocal(c.fechaFin);
    if (t >= ini && t <= fin) return c;
  }
  return null;
}

/** Texto corto de cortes para UI (ej. "27–11 o 12–26"). */
export function describirCortes(config: PeriodosNominaConfig): string {
  const fmt = (c: CorteQuincena) => {
    const fin = c.diaFin === 0 ? "fin de mes" : String(c.diaFin);
    return `${c.diaInicio}–${fin}`;
  };
  return `${fmt(config.a)} o ${fmt(config.b)}`;
}

/** ¿La quincena B del mes (de `hoy`) ya empezó? */
export function quincenaBYaEmpezo(
  hoy: Date,
  config: PeriodosNominaConfig,
): boolean {
  return hoy.getDate() >= config.b.diaInicio;
}
