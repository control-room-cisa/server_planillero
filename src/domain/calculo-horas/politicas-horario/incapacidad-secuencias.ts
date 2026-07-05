import { addDaysYmd } from "../../../utils/dateTime";
import {
  calcularSubsidioDiarioIhss,
  roundTo2Decimals,
  type FetchTechoIhssMonto,
} from "./subsidio-ihss";

/** Tamaño de cada bloque al retroceder en el historial. */
export const INCAP_CHUNK_DAYS = 100;

/** Máximo de días hacia atrás desde el primer día visible de la secuencia. */
export const INCAP_MAX_LOOKBACK_DAYS = 800;

export type IncapacidadFlagRow = {
  fecha: string;
  esIncapacidad: boolean;
};

export type FetchIncapacidadFlags = (
  fechaDesde: string,
  fechaHasta: string
) => Promise<IncapacidadFlagRow[]>;

export type SecuenciaIncapacidadEnRango = {
  /** Día 1 de la secuencia (puede estar fuera del rango de nómina). */
  fechaInicioSecuencia: string;
  /** Días con esIncapacidad=true dentro del rango evaluado. */
  fechasEnRango: string[];
  /** Subsidio diario IHSS (2 decimales); 0 si no hay días IHSS en el rango. */
  subsidioDiario: number;
  /** Días IHSS (ordinal ≥ 4) dentro del rango evaluado. */
  diasIhssEnRango: number;
  /** diasIhssEnRango × subsidioDiario (subsidio ya redondeado). */
  montoIhssEnRango: number;
};

export type ClasificacionIncapacidadDia = {
  tipo: "empresa" | "ihss";
  /** Posición 1-based dentro de la secuencia consecutiva. */
  ordinal: number;
  fechaInicioSecuencia: string;
  /** Subsidio diario IHSS; 0 en días empresa. */
  subsidioDiario: number;
};

export type IncapacidadIhssResumen = {
  diasIhss: number;
  montoIhss: number;
  secuencias: Array<{
    fechaInicioSecuencia: string;
    subsidioDiario: number;
    diasIhssEnRango: number;
    montoIhssEnRango: number;
  }>;
};

export function daysInclusiveYmd(a: string, b: string): number {
  const [Y1, M1, D1] = a.split("-").map(Number);
  const [Y2, M2, D2] = b.split("-").map(Number);
  const d1 = Date.UTC(Y1, M1 - 1, D1);
  const d2 = Date.UTC(Y2, M2 - 1, D2);
  return Math.floor((d2 - d1) / 86400000) + 1;
}

type DiaIncapState = true | false | "missing";

const LOG_PREFIX = "[Incapacidad/IHSS]";

function logDia1SecuenciaEncontrado(params: {
  fechaAnclaEnRango: string;
  fechaInicioSecuencia: string;
  motivo: "ruptura" | "max_lookback";
  diaRuptura?: string;
  estadoRuptura?: DiaIncapState;
  diasRetrocedidos?: number;
}) {
  console.log(`${LOG_PREFIX} Día 1 de secuencia encontrado`, params);
}

function identificarSecuenciasEnRango(
  fechaInicio: string,
  fechaFin: string,
  fechasIncapEnRango: Set<string>
): string[][] {
  const secuencias: string[][] = [];
  let actual: string[] = [];
  let f = fechaInicio;

  while (f <= fechaFin) {
    if (fechasIncapEnRango.has(f)) {
      actual.push(f);
    } else if (actual.length > 0) {
      secuencias.push(actual);
      actual = [];
    }
    f = addDaysYmd(f, 1);
  }

  if (actual.length > 0) secuencias.push(actual);
  return secuencias;
}

function indexFlags(rows: IncapacidadFlagRow[]): Map<string, DiaIncapState> {
  const map = new Map<string, DiaIncapState>();
  for (const row of rows) {
    map.set(row.fecha, row.esIncapacidad ? true : false);
  }
  return map;
}

/**
 * Retrocede en bloques de {@link INCAP_CHUNK_DAYS} hasta encontrar el día 1
 * de la secuencia (primer día con esIncapacidad=true tras una ruptura).
 */
export async function findPrimerDiaSecuenciaIncapacidad(
  fechaEnSecuencia: string,
  fetchFlags: FetchIncapacidadFlags
): Promise<string> {
  const cache = new Map<string, DiaIncapState>();
  let cursorFin = fechaEnSecuencia;
  let primerDia = fechaEnSecuencia;
  let diasRetrocedidos = 0;

  const cargarBloque = async (desde: string, hasta: string) => {
    const rows = await fetchFlags(desde, hasta);
    for (const [fecha, state] of indexFlags(rows)) {
      cache.set(fecha, state);
    }
  };

  const stateEn = (fecha: string): DiaIncapState =>
    cache.get(fecha) ?? "missing";

  await cargarBloque(
    addDaysYmd(cursorFin, -(INCAP_CHUNK_DAYS - 1)),
    cursorFin
  );

  let d = addDaysYmd(fechaEnSecuencia, -1);

  while (diasRetrocedidos < INCAP_MAX_LOOKBACK_DAYS) {
    const bloqueInicio = addDaysYmd(cursorFin, -(INCAP_CHUNK_DAYS - 1));

    if (d < bloqueInicio) {
      cursorFin = addDaysYmd(bloqueInicio, -1);
      if (diasRetrocedidos >= INCAP_MAX_LOOKBACK_DAYS) break;
      await cargarBloque(
        addDaysYmd(cursorFin, -(INCAP_CHUNK_DAYS - 1)),
        cursorFin
      );
      continue;
    }

    const state = stateEn(d);
    if (state === true) {
      primerDia = d;
      d = addDaysYmd(d, -1);
      diasRetrocedidos++;
      continue;
    }

    logDia1SecuenciaEncontrado({
      fechaAnclaEnRango: fechaEnSecuencia,
      fechaInicioSecuencia: primerDia,
      motivo: "ruptura",
      diaRuptura: d,
      estadoRuptura: state,
      diasRetrocedidos,
    });
    return primerDia;
  }

  logDia1SecuenciaEncontrado({
    fechaAnclaEnRango: fechaEnSecuencia,
    fechaInicioSecuencia: primerDia,
    motivo: "max_lookback",
    diasRetrocedidos,
  });
  return primerDia;
}

function clasificarDiaIncapacidad(
  fecha: string,
  fechaInicioSecuencia: string,
  subsidioDiario: number
): ClasificacionIncapacidadDia {
  const ordinal = daysInclusiveYmd(fechaInicioSecuencia, fecha);
  const tipo: "empresa" | "ihss" = ordinal <= 3 ? "empresa" : "ihss";
  return {
    tipo,
    ordinal,
    fechaInicioSecuencia,
    subsidioDiario: tipo === "ihss" ? subsidioDiario : 0,
  };
}

/**
 * Detecta secuencias de incapacidad dentro del rango de nómina, resuelve
 * el día 1 de cada una y calcula subsidio IHSS solo para días IHSS en el rango.
 */
export async function calcularSecuenciasIncapacidadEnRango(
  fechaInicio: string,
  fechaFin: string,
  fetchFlags: FetchIncapacidadFlags,
  fetchTecho: FetchTechoIhssMonto
): Promise<{
  secuencias: SecuenciaIncapacidadEnRango[];
  clasificacionPorFecha: Map<string, ClasificacionIncapacidadDia>;
  errores: string[];
  incapacidadIhss: IncapacidadIhssResumen;
}> {
  const rowsEnRango = await fetchFlags(fechaInicio, fechaFin);
  const fechasIncapEnRango = new Set<string>();

  for (const row of rowsEnRango) {
    if (row.esIncapacidad) fechasIncapEnRango.add(row.fecha);
  }

  if (fechasIncapEnRango.size === 0) {
    return {
      secuencias: [],
      clasificacionPorFecha: new Map(),
      errores: [],
      incapacidadIhss: { diasIhss: 0, montoIhss: 0, secuencias: [] },
    };
  }

  console.log(`${LOG_PREFIX} Evaluando secuencias en rango nómina`, {
    fechaInicio,
    fechaFin,
    diasIncapEnRango: [...fechasIncapEnRango].sort(),
  });

  const segmentos = identificarSecuenciasEnRango(
    fechaInicio,
    fechaFin,
    fechasIncapEnRango
  );

  const secuencias: SecuenciaIncapacidadEnRango[] = [];
  const clasificacionPorFecha = new Map<string, ClasificacionIncapacidadDia>();
  const errores: string[] = [];
  const resumenSecuencias: IncapacidadIhssResumen["secuencias"] = [];
  let totalDiasIhss = 0;
  let totalMontoIhss = 0;

  for (const fechasEnRango of segmentos) {
    console.log(`${LOG_PREFIX} Resolviendo secuencia`, {
      primerDiaVisibleEnRango: fechasEnRango[0],
      fechasEnRango,
    });

    const fechaInicioSecuencia = await findPrimerDiaSecuenciaIncapacidad(
      fechasEnRango[0],
      fetchFlags
    );

    const clasificaciones = fechasEnRango.map((fecha) =>
      clasificarDiaIncapacidad(fecha, fechaInicioSecuencia, 0)
    );

    const diasIhssEnRango = clasificaciones.filter((c) => c.tipo === "ihss")
      .length;

    console.log(`${LOG_PREFIX} Secuencia clasificada`, {
      fechaInicioSecuencia,
      diasEnRango: fechasEnRango.length,
      diasIhssEnRango,
      ordinales: clasificaciones.map((c, i) => ({
        fecha: fechasEnRango[i],
        ordinal: c.ordinal,
        tipo: c.tipo,
      })),
    });

    let subsidioDiario = 0;
    if (diasIhssEnRango > 0) {
      const subsidioResult = await calcularSubsidioDiarioIhss(
        fechaInicioSecuencia,
        fetchTecho
      );
      if (!subsidioResult.ok) {
        errores.push(subsidioResult.error);
        continue;
      }
      subsidioDiario = subsidioResult.data.subsidioDiario;
    }

    const montoIhssEnRango = roundTo2Decimals(diasIhssEnRango * subsidioDiario);

    secuencias.push({
      fechaInicioSecuencia,
      fechasEnRango,
      subsidioDiario,
      diasIhssEnRango,
      montoIhssEnRango,
    });

    for (const fecha of fechasEnRango) {
      clasificacionPorFecha.set(
        fecha,
        clasificarDiaIncapacidad(fecha, fechaInicioSecuencia, subsidioDiario)
      );
    }

    if (diasIhssEnRango > 0) {
      resumenSecuencias.push({
        fechaInicioSecuencia,
        subsidioDiario,
        diasIhssEnRango,
        montoIhssEnRango,
      });
      totalDiasIhss += diasIhssEnRango;
      totalMontoIhss += montoIhssEnRango;
    }
  }

  return {
    secuencias,
    clasificacionPorFecha,
    errores,
    incapacidadIhss: {
      diasIhss: totalDiasIhss,
      montoIhss: roundTo2Decimals(totalMontoIhss),
      secuencias: resumenSecuencias,
    },
  };
}
