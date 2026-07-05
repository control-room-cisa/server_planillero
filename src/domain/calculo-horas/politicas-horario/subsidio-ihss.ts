/** Factor legal del subsidio IHSS sobre salario base diario. */
export const SUBSIDIO_IHSS_FACTOR = 0.66;

export type MesCalendarioRef = {
  year: number;
  month: number;
  ymdPrimerDia: string;
};

export type FetchTechoIhssMonto = (fecha: string) => Promise<number | null>;

export type SubsidioIhssCalculado = {
  subsidioDiario: number;
  salarioBaseDiario: number;
  totalTecho3Meses: number;
  totalDias3Meses: number;
};

export function roundTo2Decimals(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Días calendario de un mes (month 1–12). */
export function diasCalendarioDelMes(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Tres meses calendario completos anteriores al mes de {@link fechaInicioSecuencia}.
 * Ej.: 2025-05-12 → feb, mar y abr 2025.
 */
export function obtenerTresMesesCalendarioAnteriores(
  fechaInicioSecuencia: string
): MesCalendarioRef[] {
  const [Y, M] = fechaInicioSecuencia.split("-").map(Number);
  const meses: MesCalendarioRef[] = [];

  for (let offset = 3; offset >= 1; offset--) {
    let month = M - offset;
    let year = Y;
    while (month <= 0) {
      month += 12;
      year -= 1;
    }
    meses.push({
      year,
      month,
      ymdPrimerDia: `${year}-${String(month).padStart(2, "0")}-01`,
    });
  }

  return meses;
}

function etiquetaMes(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

const LOG_PREFIX = "[Incapacidad/IHSS]";

/**
 * Calcula subsidio diario IHSS a partir del Techo IHSS vigente el día 1
 * de cada uno de los 3 meses calendario anteriores al mes de inicio de secuencia.
 */
export async function calcularSubsidioDiarioIhss(
  fechaInicioSecuencia: string,
  fetchTecho: FetchTechoIhssMonto
): Promise<{ ok: true; data: SubsidioIhssCalculado } | { ok: false; error: string }> {
  const meses = obtenerTresMesesCalendarioAnteriores(fechaInicioSecuencia);

  console.log(`${LOG_PREFIX} Cálculo subsidio — meses de referencia`, {
    fechaInicioSecuencia,
    mesesReferencia: meses.map((m) => ({
      mes: etiquetaMes(m.year, m.month),
      ymdConsultaTecho: m.ymdPrimerDia,
      diasCalendario: diasCalendarioDelMes(m.year, m.month),
    })),
  });

  let totalTecho3Meses = 0;
  let totalDias3Meses = 0;

  for (const { year, month, ymdPrimerDia } of meses) {
    const techo = await fetchTecho(ymdPrimerDia);
    const mesLabel = etiquetaMes(year, month);

    console.log(`${LOG_PREFIX} Techo IHSS mes ${mesLabel}`, {
      fechaInicioSecuencia,
      ymdConsulta: ymdPrimerDia,
      techoEncontrado: techo != null,
      monto: techo ?? null,
    });

    if (techo == null) {
      const error = `No hay Techo IHSS vigente para ${mesLabel} (requerido para incapacidad con inicio ${fechaInicioSecuencia}).`;
      console.warn(`${LOG_PREFIX} Subsidio abortado`, { error, ymdConsulta: ymdPrimerDia });
      return { ok: false, error };
    }
    totalTecho3Meses += techo;
    totalDias3Meses += diasCalendarioDelMes(year, month);
  }

  const salarioBaseDiario = totalTecho3Meses / totalDias3Meses;
  const subsidioDiario = roundTo2Decimals(salarioBaseDiario * SUBSIDIO_IHSS_FACTOR);

  console.log(`${LOG_PREFIX} Subsidio calculado`, {
    fechaInicioSecuencia,
    totalTecho3Meses,
    totalDias3Meses,
    salarioBaseDiario,
    subsidioDiario,
  });

  return {
    ok: true,
    data: {
      subsidioDiario,
      salarioBaseDiario,
      totalTecho3Meses,
      totalDias3Meses,
    },
  };
}
