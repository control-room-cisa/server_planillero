import { describe, it, expect } from "vitest";
import { PoliticaH1_1 } from "../src/domain/calculo-horas/politicas-horario/H1_1";

/** =========================
 *   Stubs / helpers comunes
 *  ========================= */
class H1Test extends PoliticaH1_1 {
  private registros: Record<string, any> = {};
  private feriados: Record<string, boolean> = {};
  seedRegistro(fecha: string, reg: any) {
    this.registros[fecha] = reg;
  }
  seedFeriado(fecha: string, esFeriado: boolean) {
    this.feriados[fecha] = esFeriado;
  }
  protected async getRegistroDiario(_empleadoId: string, fecha: string) {
    // En producción, el repositorio solo devuelve actividades del día actual
    // Las actividades que cruzan medianoche se manejan en el segmentador
    // pero para el prorrateo por job, solo se cuentan las actividades del día actual
    return this.registros[fecha] ?? null;
  }
  protected async esFeriado(fecha: string) {
    return {
      esFeriado: !!this.feriados[fecha],
      nombre: this.feriados[fecha] ? "Feriado" : "",
    };
  }
  protected async getEmpleado(_empleadoId: string) {
    return { id: Number(_empleadoId), nombre: "Test" } as any;
  }

  // Helper para agregar días a una fecha
  private addDays(fecha: string, dias: number): string {
    const d = new Date(`${fecha}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + dias);
    return d.toISOString().split("T")[0];
  }
}

// helper: horas locales (UTC-6) → Date UTC
function makeDateUTC(fecha: string, hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(`${fecha}T00:00:00.000Z`);
  d.setUTCHours(h, m ?? 0, 0, 0);
  return d;
}

// === utilidades nuevas/actualizadas ===
type HorasPorJob = {
  jobId: number;
  codigoJob: string;
  nombreJob: string;
  cantidadHoras: number;
};

function sumHoras(arr: HorasPorJob[]) {
  return Number(arr.reduce((acc, x) => acc + x.cantidadHoras, 0).toFixed(4));
}

function toIndex(arr: HorasPorJob[]) {
  const map = new Map<string, number>();
  for (const x of arr)
    map.set(x.codigoJob, (map.get(x.codigoJob) ?? 0) + x.cantidadHoras);
  return map;
}

// Unión de todos los jobs usados en el día (en cualquier banda, incluidas compensatorias)
function allJobsOfDay(exp: {
  normal: HorasPorJob[];
  p25: HorasPorJob[];
  p50: HorasPorJob[];
  p75: HorasPorJob[];
  p100: HorasPorJob[];
  compDevueltas?: HorasPorJob[];
}) {
  const s = new Set<string>();
  [exp.normal, exp.p25, exp.p50, exp.p75, exp.p100, exp.compDevueltas ?? []].forEach(
    (arr) => arr.forEach((j) => s.add(j.codigoJob))
  );
  return [...s].sort();
}

// Helper para formatear valor - marca con ❌ si no coincide
function formatValue(got: number, exp: number): string {
  const gotStr = got.toFixed(4);
  if (Math.abs(got - exp) > 0.0001) {
    return `${gotStr}❌`;
  }
  return gotStr;
}

// Tabla ancha: una fila por job con columnas esperado/obtenido por banda
// Incluye columna de compensatorias devueltas (extra=true, compensatorio=true)
function rowsWideByJob(
  gotBands: {
    normal: HorasPorJob[];
    p25: HorasPorJob[];
    p50: HorasPorJob[];
    p75: HorasPorJob[];
    p100: HorasPorJob[];
    compDevueltas?: HorasPorJob[];
  },
  expBands: {
    normal: HorasPorJob[];
    p25: HorasPorJob[];
    p50: HorasPorJob[];
    p75: HorasPorJob[];
    p100: HorasPorJob[];
    compDevueltas?: HorasPorJob[];
  }
) {
  const expIdx = {
    normal: toIndex(expBands.normal),
    p25: toIndex(expBands.p25),
    p50: toIndex(expBands.p50),
    p75: toIndex(expBands.p75),
    p100: toIndex(expBands.p100),
    compDevueltas: toIndex(expBands.compDevueltas ?? []),
  };
  const gotIdx = {
    normal: toIndex(gotBands.normal ?? []),
    p25: toIndex(gotBands.p25 ?? []),
    p50: toIndex(gotBands.p50 ?? []),
    p75: toIndex(gotBands.p75 ?? []),
    p100: toIndex(gotBands.p100 ?? []),
    compDevueltas: toIndex(gotBands.compDevueltas ?? []),
  };

  const jobs = new Set<string>([
    ...allJobsOfDay(expBands),
    ...Object.values(gotIdx).flatMap((m) => [...m.keys()]),
  ]);

  const rows = [...jobs].sort().map((codigo) => {
    const eN = Number((expIdx.normal.get(codigo) ?? 0).toFixed(4));
    const gN = Number((gotIdx.normal.get(codigo) ?? 0).toFixed(4));
    const e25 = Number((expIdx.p25.get(codigo) ?? 0).toFixed(4));
    const g25 = Number((gotIdx.p25.get(codigo) ?? 0).toFixed(4));
    const e50 = Number((expIdx.p50.get(codigo) ?? 0).toFixed(4));
    const g50 = Number((gotIdx.p50.get(codigo) ?? 0).toFixed(4));
    const e75 = Number((expIdx.p75.get(codigo) ?? 0).toFixed(4));
    const g75 = Number((gotIdx.p75.get(codigo) ?? 0).toFixed(4));
    const e100 = Number((expIdx.p100.get(codigo) ?? 0).toFixed(4));
    const g100 = Number((gotIdx.p100.get(codigo) ?? 0).toFixed(4));
    const eComp = Number((expIdx.compDevueltas.get(codigo) ?? 0).toFixed(4));
    const gComp = Number((gotIdx.compDevueltas.get(codigo) ?? 0).toFixed(4));

    return {
      job: codigo,
      comp: eComp > 0 || gComp > 0 ? "✔" : "",  // marca si es compensatoria pagada
      "norm✓": eN,
      "norm✗": formatValue(gN, eN),
      "25%✓": e25,
      "25%✗": formatValue(g25, e25),
      "50%✓": e50,
      "50%✗": formatValue(g50, e50),
      "75%✓": e75,
      "75%✗": formatValue(g75, e75),
      "100%✓": e100,
      "100%✗": formatValue(g100, e100),
      "cDev✓": eComp,
      "cDev✗": formatValue(gComp, eComp),
    };
  });

  // Totales por banda (fila final)
  const totalNormExp = sumHoras(expBands.normal);
  const totalNormGot = sumHoras(gotBands.normal ?? []);
  const total25Exp = sumHoras(expBands.p25);
  const total25Got = sumHoras(gotBands.p25 ?? []);
  const total50Exp = sumHoras(expBands.p50);
  const total50Got = sumHoras(gotBands.p50 ?? []);
  const total75Exp = sumHoras(expBands.p75);
  const total75Got = sumHoras(gotBands.p75 ?? []);
  const total100Exp = sumHoras(expBands.p100);
  const total100Got = sumHoras(gotBands.p100 ?? []);
  const totalCompExp = sumHoras(expBands.compDevueltas ?? []);
  const totalCompGot = sumHoras(gotBands.compDevueltas ?? []);

  rows.push({
    job: "TOTAL",
    comp: "",
    "norm✓": totalNormExp,
    "norm✗": formatValue(totalNormGot, totalNormExp),
    "25%✓": total25Exp,
    "25%✗": formatValue(total25Got, total25Exp),
    "50%✓": total50Exp,
    "50%✗": formatValue(total50Got, total50Exp),
    "75%✓": total75Exp,
    "75%✗": formatValue(total75Got, total75Exp),
    "100%✓": total100Exp,
    "100%✗": formatValue(total100Got, total100Exp),
    "cDev✓": totalCompExp,
    "cDev✗": formatValue(totalCompGot, totalCompExp),
  });

  return rows;
}

// Verifica si hay diferencias antes de imprimir
function hasDifferences(
  got: {
    normal: HorasPorJob[];
    p25: HorasPorJob[];
    p50: HorasPorJob[];
    p75: HorasPorJob[];
    p100: HorasPorJob[];
    compDevueltas?: HorasPorJob[];
    totalHorasLaborables: number;
    horasFeriado?: number;
    horasCompensatoriasTomadas?: number;
  },
  exp: {
    normal: HorasPorJob[];
    p25: HorasPorJob[];
    p50: HorasPorJob[];
    p75: HorasPorJob[];
    p100: HorasPorJob[];
    compDevueltas?: HorasPorJob[];
    totalHorasLaborables: number;
    horasFeriado?: number;
    horasCompensatoriasTomadas?: number;
  }
): boolean {
  const assertBandEqual = (gotArr: HorasPorJob[], expArr: HorasPorJob[]) => {
    const norm = (a: HorasPorJob[]) =>
      [...a]
        .map(({ codigoJob, cantidadHoras }) => ({
          codigoJob,
          cantidadHoras: Number(cantidadHoras.toFixed(4)),
        }))
        .sort((x, y) =>
          x.codigoJob < y.codigoJob
            ? -1
            : x.codigoJob > y.codigoJob
            ? 1
            : x.cantidadHoras - y.cantidadHoras
        );
    const gotNorm = norm(gotArr ?? []);
    const expNorm = norm(expArr);
    if (gotNorm.length !== expNorm.length) return false;
    for (let i = 0; i < gotNorm.length; i++) {
      if (
        gotNorm[i].codigoJob !== expNorm[i].codigoJob ||
        Math.abs(gotNorm[i].cantidadHoras - expNorm[i].cantidadHoras) > 0.0001
      ) {
        return false;
      }
    }
    return Math.abs(sumHoras(gotArr ?? []) - sumHoras(expArr)) < 0.0001;
  };

  const totalGot =
    sumHoras(got.normal ?? []) +
    sumHoras(got.p25 ?? []) +
    sumHoras(got.p50 ?? []) +
    sumHoras(got.p75 ?? []) +
    sumHoras(got.p100 ?? []);
  const totalExp =
    sumHoras(exp.normal) +
    sumHoras(exp.p25) +
    sumHoras(exp.p50) +
    sumHoras(exp.p75) +
    sumHoras(exp.p100);

  if (Math.abs(totalGot - totalExp) > 0.0001) return true;
  if (
    Math.abs((got.totalHorasLaborables ?? 0) - exp.totalHorasLaborables) >
    0.0001
  )
    return true;
  if (Math.abs((got.horasFeriado ?? 0) - (exp.horasFeriado ?? 0)) > 0.0001)
    return true;
  if (
    Math.abs(
      (got.horasCompensatoriasTomadas ?? 0) -
        (exp.horasCompensatoriasTomadas ?? 0)
    ) > 0.0001
  )
    return true;
  if (!assertBandEqual(got.normal ?? [], exp.normal)) return true;
  if (!assertBandEqual(got.p25 ?? [], exp.p25)) return true;
  if (!assertBandEqual(got.p50 ?? [], exp.p50)) return true;
  if (!assertBandEqual(got.p75 ?? [], exp.p75)) return true;
  if (!assertBandEqual(got.p100 ?? [], exp.p100)) return true;
  if (!assertBandEqual(got.compDevueltas ?? [], exp.compDevueltas ?? []))
    return true;

  return false;
}

/**
 * Tabla 1 — Prorrateo por Job (bands normales + extras + compensatorias devueltas)
 *   comp = "✔" si el job tiene horas compensatorias devueltas (extra=true, compensatorio=true)
 *   cDev = compensatorias devueltas (extra=true, compensatorio=true)  — columna nueva
 *
 * Tabla 2 — Resumen de métricas:
 *   TOT   = suma de todas las bandas del día (normal+p25+p50+p75+p100)
 *   Lab   = totalHorasLaborables  → horas de jornada normal laborable
 *   Fer   = horasFeriado          → horas trabajadas en día feriado / día libre
 *   Vac   = vacacionesHoras       → horas de vacaciones tomadas
 *   Incap = incapacidadHoras      → horas de incapacidad (empresa / IHSS)
 *   CTom  = horasCompensatoriasTomadas → horas normales marcadas compensatorio=true
 *                                        (extra=false, compensatorio=true)
 */
function logProrrateoAndAssert(
  fecha: string,
  got: {
    normal: HorasPorJob[];
    p25: HorasPorJob[];
    p50: HorasPorJob[];
    p75: HorasPorJob[];
    p100: HorasPorJob[];
    totalHorasLaborables: number;
    horasFeriado: number;
    vacacionesHoras: number;
    permisoConSueldoHoras: number;
    permisoSinSueldoHoras: number;
    inasistenciasHoras: number;
    deduccionesISR: number;
    deduccionesRAP: number;
    deduccionesAlimentacion: number;
    deduccionesIHSS: number;
    Prestamo: number;
    Total: number;
    horasCompensatoriasTomadas?: number;
    horasCompensatoriasDevueltasPorJob?: HorasPorJob[];
  },
  exp: {
    normal: HorasPorJob[];
    p25: HorasPorJob[];
    p50: HorasPorJob[];
    p75: HorasPorJob[];
    p100: HorasPorJob[];
    totalHorasLaborables: number;
    horasFeriado?: number;
    vacacionesHoras?: number;
    incapacidadHoras?: number;
    horasCompensatoriasTomadas?: number;
    compDevueltas?: HorasPorJob[];
  }
) {
  const gotCompDev = got.horasCompensatoriasDevueltasPorJob ?? [];
  const expCompDev = exp.compDevueltas ?? [];

  // Verificar si hay diferencias antes de imprimir
  const hasDiff = hasDifferences(
    {
      normal: got.normal ?? [],
      p25: got.p25 ?? [],
      p50: got.p50 ?? [],
      p75: got.p75 ?? [],
      p100: got.p100 ?? [],
      compDevueltas: gotCompDev,
      totalHorasLaborables: got.totalHorasLaborables ?? 0,
      horasFeriado: got.horasFeriado ?? 0,
      horasCompensatoriasTomadas: got.horasCompensatoriasTomadas ?? 0,
    },
    {
      ...exp,
      compDevueltas: expCompDev,
      horasCompensatoriasTomadas: exp.horasCompensatoriasTomadas ?? 0,
    }
  );

  // Solo imprimir si hay diferencias
  if (hasDiff) {
    // 1) Tabla ancha, una fila por job (incluye columna de compensatorias devueltas)
    const wide = rowsWideByJob(
      {
        normal: got.normal ?? [],
        p25: got.p25 ?? [],
        p50: got.p50 ?? [],
        p75: got.p75 ?? [],
        p100: got.p100 ?? [],
        compDevueltas: gotCompDev,
      },
      {
        normal: exp.normal,
        p25: exp.p25,
        p50: exp.p50,
        p75: exp.p75,
        p100: exp.p100,
        compDevueltas: expCompDev,
      }
    );

    // eslint-disable-next-line no-console
    console.log(`\n▶️ ${fecha} — Prorrateo por Job (Esperado vs Obtenido)`);
    // eslint-disable-next-line no-console
    console.table(wide);

    // 2) Resumen de métricas del día
    const totalGot =
      sumHoras(got.normal ?? []) +
      sumHoras(got.p25 ?? []) +
      sumHoras(got.p50 ?? []) +
      sumHoras(got.p75 ?? []) +
      sumHoras(got.p100 ?? []);
    const totalExp =
      sumHoras(exp.normal) +
      sumHoras(exp.p25) +
      sumHoras(exp.p50) +
      sumHoras(exp.p75) +
      sumHoras(exp.p100);

    // eslint-disable-next-line no-console
    console.table([
      {
        métrica: "TOT",
        "✓": Number(totalExp.toFixed(4)),
        "✗": formatValue(totalGot, totalExp),
      },
      {
        métrica: "Lab",
        "✓": Number(exp.totalHorasLaborables.toFixed(4)),
        "✗": formatValue(
          got.totalHorasLaborables ?? 0,
          exp.totalHorasLaborables
        ),
      },
      {
        métrica: "Fer",
        "✓": Number((exp.horasFeriado ?? 0).toFixed(4)),
        "✗": formatValue(got.horasFeriado ?? 0, exp.horasFeriado ?? 0),
      },
      {
        métrica: "Vac",
        "✓": Number((exp.vacacionesHoras ?? 0).toFixed(4)),
        "✗": formatValue(got.vacacionesHoras ?? 0, exp.vacacionesHoras ?? 0),
      },
      {
        métrica: "Incap",
        "✓": Number((exp.incapacidadHoras ?? 0).toFixed(4)),
        "✗": formatValue(got.incapacidadHoras ?? 0, exp.incapacidadHoras ?? 0),
      },
      {
        métrica: "CTom",
        "✓": Number((exp.horasCompensatoriasTomadas ?? 0).toFixed(4)),
        "✗": formatValue(
          got.horasCompensatoriasTomadas ?? 0,
          exp.horasCompensatoriasTomadas ?? 0
        ),
      },
    ]);
  }

  // 3) Asserts banda a banda
  const assertBand = (gotArr: HorasPorJob[], expArr: HorasPorJob[]) => {
    const norm = (a: HorasPorJob[]) =>
      [...a]
        .map(({ codigoJob, cantidadHoras }) => ({
          codigoJob,
          cantidadHoras: Number(cantidadHoras.toFixed(4)),
        }))
        .sort((x, y) =>
          x.codigoJob < y.codigoJob
            ? -1
            : x.codigoJob > y.codigoJob
            ? 1
            : x.cantidadHoras - y.cantidadHoras
        );
    expect(norm(gotArr ?? [])).toEqual(norm(expArr));
    expect(sumHoras(gotArr ?? [])).toBeCloseTo(sumHoras(expArr), 6);
  };

  assertBand(got.normal ?? [], exp.normal);
  assertBand(got.p25 ?? [], exp.p25);
  assertBand(got.p50 ?? [], exp.p50);
  assertBand(got.p75 ?? [], exp.p75);
  assertBand(got.p100 ?? [], exp.p100);
  // Compensatorias devueltas (extra=true, compensatorio=true)
  assertBand(gotCompDev, expCompDev);

  const totalGot =
    sumHoras(got.normal ?? []) +
    sumHoras(got.p25 ?? []) +
    sumHoras(got.p50 ?? []) +
    sumHoras(got.p75 ?? []) +
    sumHoras(got.p100 ?? []);
  const totalExp =
    sumHoras(exp.normal) +
    sumHoras(exp.p25) +
    sumHoras(exp.p50) +
    sumHoras(exp.p75) +
    sumHoras(exp.p100);

  expect(Number(totalGot.toFixed(6))).toBeCloseTo(
    Number(totalExp.toFixed(6)),
    6
  );
  expect(got.totalHorasLaborables).toBeCloseTo(exp.totalHorasLaborables, 6);

  expect(got.horasFeriado ?? 0).toBe(exp.horasFeriado ?? 0);
  expect(got.vacacionesHoras).toBe(exp.vacacionesHoras ?? 0);
  expect(got.incapacidadHoras ?? 0).toBe(exp.incapacidadHoras ?? 0);
  // Compensatorias tomadas (extra=false, compensatorio=true)
  expect(got.horasCompensatoriasTomadas ?? 0).toBeCloseTo(
    exp.horasCompensatoriasTomadas ?? 0,
    6
  );
  expect(got.permisoConSueldoHoras).toBe(0);
  expect(got.permisoSinSueldoHoras).toBe(0);
  expect(got.inasistenciasHoras).toBe(0);
  expect(got.deduccionesISR).toBe(0);
  expect(got.deduccionesRAP).toBe(0);
  expect(got.deduccionesAlimentacion).toBe(0);
  expect(got.deduccionesIHSS).toBe(0);
  expect(got.Prestamo).toBe(0);
  expect(got.Total).toBe(0);
}

/** =========================
 *   Datos esperados por día
 *  ========================= */
const expectedByDate: Record<string, any> = {
  "2025-09-11": {
    normal: [
      { jobId: 0, codigoJob: "101", nombreJob: "101", cantidadHoras: 4 },
      { jobId: 0, codigoJob: "105", nombreJob: "105", cantidadHoras: 2 },
      { jobId: 0, codigoJob: "108", nombreJob: "108", cantidadHoras: 3 },
    ],
    p25: [{ jobId: 0, codigoJob: "100", nombreJob: "100", cantidadHoras: 2 }],
    p50: [{ jobId: 0, codigoJob: "100", nombreJob: "100", cantidadHoras: 3 }],
    p75: [{ jobId: 0, codigoJob: "100", nombreJob: "100", cantidadHoras: 2 }],
    p100: [],
    totalHorasLaborables: 9,
    horasFeriado: 0,
  },
  "2025-09-12": {
    normal: [
      { jobId: 0, codigoJob: "101", nombreJob: "101", cantidadHoras: 1 },
      { jobId: 0, codigoJob: "106", nombreJob: "106", cantidadHoras: 5 },
      { jobId: 0, codigoJob: "107", nombreJob: "107", cantidadHoras: 2 },
    ],
    p25: [],
    p50: [{ jobId: 0, codigoJob: "108", nombreJob: "108", cantidadHoras: 3 }],
    p75: [
      { jobId: 0, codigoJob: "101", nombreJob: "101", cantidadHoras: 4 },
      { jobId: 0, codigoJob: "108", nombreJob: "108", cantidadHoras: 3 },
    ],
    p100: [],
    totalHorasLaborables: 8,
    horasFeriado: 0,
  },
  "2025-09-13": {
    normal: [],
    p25: [],
    p50: [{ jobId: 0, codigoJob: "100", nombreJob: "100", cantidadHoras: 3 }],
    p75: [{ jobId: 0, codigoJob: "100", nombreJob: "100", cantidadHoras: 8 }],
    p100: [],
    totalHorasLaborables: 0,
    horasFeriado: 0,
  },
  "2025-09-14": {
    normal: [],
    p25: [],
    p50: [],
    p75: [],
    p100: [],
    totalHorasLaborables: 0,
    horasFeriado: 0,
  },
  "2025-09-15": {
    normal: [],
    p25: [],
    p50: [],
    p75: [],
    p100: [{ jobId: 0, codigoJob: "100", nombreJob: "100", cantidadHoras: 8 }],
    totalHorasLaborables: 0,
    horasFeriado: 0,
  },
  "2025-09-16": {
    normal: [
      { jobId: 0, codigoJob: "101", nombreJob: "101", cantidadHoras: 4 },
      { jobId: 0, codigoJob: "102", nombreJob: "102", cantidadHoras: 3 },
      { jobId: 0, codigoJob: "103", nombreJob: "103", cantidadHoras: 2 },
    ],
    p25: [],
    p50: [],
    p75: [{ jobId: 0, codigoJob: "100", nombreJob: "100", cantidadHoras: 7 }],
    p100: [],
    totalHorasLaborables: 9,
    horasFeriado: 0,
  },
  "2025-09-17": {
    normal: [
      { jobId: 0, codigoJob: "100", nombreJob: "100", cantidadHoras: 9 },
    ],
    p25: [],
    p50: [{ jobId: 0, codigoJob: "105", nombreJob: "105", cantidadHoras: 3 }],
    p75: [{ jobId: 0, codigoJob: "105", nombreJob: "105", cantidadHoras: 2 }],
    p100: [],
    totalHorasLaborables: 9,
    horasFeriado: 0,
  },
  "2025-09-18": {
    normal: [
      { jobId: 0, codigoJob: "100", nombreJob: "100", cantidadHoras: 9 },
    ],
    p25: [],
    p50: [{ jobId: 0, codigoJob: "101", nombreJob: "101", cantidadHoras: 3 }],
    p75: [
      { jobId: 0, codigoJob: "101", nombreJob: "101", cantidadHoras: 4.25 },
    ],
    p100: [],
    totalHorasLaborables: 9,
    horasFeriado: 0,
  },
  "2025-09-19": {
    normal: [
      {
        jobId: 0,
        codigoJob: "00",
        nombreJob: "Feriados",
        cantidadHoras: 9,
      },
    ],
    p25: [],
    p50: [],
    p75: [],
    p100: [{ jobId: 0, codigoJob: "100", nombreJob: "100", cantidadHoras: 4 }],
    totalHorasLaborables: 0,
    horasFeriado: 9,
  },
  "2025-09-20": {
    normal: [
      {
        jobId: 0,
        codigoJob: "00",
        nombreJob: "Feriados",
        cantidadHoras: 9,
      },
    ],
    p25: [],
    p50: [],
    p75: [],
    p100: [],
    totalHorasLaborables: 0,
    horasFeriado: 9,
  },
};

/** =========================
 *    Generador de fixtures
 *  ========================= */
function seedInputForDate(p: H1Test, fecha: string) {
  switch (fecha) {
    case "2025-09-11":
      p.seedRegistro(fecha, {
        fecha,
        horaEntrada: makeDateUTC(fecha, "13:00"),
        horaSalida: makeDateUTC(fecha, "23:00"),
        esHoraCorrida: false,
        esDiaLibre: false,
        actividades: [
          {
            descripcion: "Act1",
            esExtra: false,
            job: { codigo: "101" },
            duracionHoras: 4,
          },
          {
            descripcion: "Act2",
            esExtra: false,
            job: { codigo: "105" },
            duracionHoras: 2,
          },
          {
            descripcion: "Act3",
            esExtra: false,
            job: { codigo: "108" },
            duracionHoras: 3,
          },
          {
            descripcion: "Extra 17-24",
            esExtra: true,
            horaInicio: makeDateUTC(fecha, "23:00"),
            horaFin: makeDateUTC("2025-09-12", "06:00"),
            job: { codigo: "100" },
          },
        ],
      });
      break;

    case "2025-09-12":
      p.seedRegistro(fecha, {
        fecha,
        horaEntrada: makeDateUTC(fecha, "13:00"),
        horaSalida: makeDateUTC(fecha, "22:00"),
        esHoraCorrida: false,
        esDiaLibre: false,
        actividades: [
          {
            descripcion: "Act1",
            esExtra: false,
            job: { codigo: "101" },
            duracionHoras: 1,
          },
          {
            descripcion: "Act2",
            esExtra: false,
            job: { codigo: "106" },
            duracionHoras: 5,
          },
          {
            descripcion: "Act3",
            esExtra: false,
            job: { codigo: "107" },
            duracionHoras: 2,
          },
          {
            descripcion: "Extra 03-07",
            esExtra: true,
            horaInicio: makeDateUTC(fecha, "09:00"),
            horaFin: makeDateUTC(fecha, "13:00"),
            job: { codigo: "101" },
          },
          {
            descripcion: "Extra 16-22",
            esExtra: true,
            horaInicio: makeDateUTC(fecha, "22:00"),
            horaFin: makeDateUTC("2025-09-13", "04:00"),
            job: { codigo: "108" },
          },
        ],
      });
      break;

    case "2025-09-13":
      p.seedRegistro(fecha, {
        fecha,
        horaEntrada: makeDateUTC(fecha, "13:00"),
        horaSalida: makeDateUTC(fecha, "13:00"),
        esHoraCorrida: false,
        esDiaLibre: false,
        actividades: [
          {
            descripcion: "Extra 04-12",
            esExtra: true,
            horaInicio: makeDateUTC(fecha, "10:00"),
            horaFin: makeDateUTC(fecha, "18:00"),
            job: { codigo: "100" },
          },
          {
            descripcion: "Extra 13-16",
            esExtra: true,
            horaInicio: makeDateUTC(fecha, "19:00"),
            horaFin: makeDateUTC(fecha, "22:00"),
            job: { codigo: "100" },
          },
        ],
      });
      break;

    case "2025-09-14":
      p.seedFeriado(fecha, true);
      p.seedRegistro(fecha, {
        fecha,
        horaEntrada: makeDateUTC(fecha, "13:00"),
        horaSalida: makeDateUTC(fecha, "13:00"),
        esHoraCorrida: false,
        esDiaLibre: true,
        actividades: [],
      });
      break;

    case "2025-09-15":
      p.seedFeriado(fecha, true);
      p.seedRegistro(fecha, {
        fecha,
        horaEntrada: makeDateUTC(fecha, "13:00"),
        horaSalida: makeDateUTC(fecha, "13:00"),
        esHoraCorrida: false,
        esDiaLibre: true,
        actividades: [
          {
            descripcion: "Extra 16-24",
            esExtra: true,
            horaInicio: makeDateUTC(fecha, "22:00"),
            horaFin: makeDateUTC("2025-09-16", "06:00"),
            job: { codigo: "100" },
          },
        ],
      });
      break;

    case "2025-09-16":
      p.seedRegistro(fecha, {
        fecha,
        horaEntrada: makeDateUTC(fecha, "13:00"),
        horaSalida: makeDateUTC(fecha, "23:00"),
        esHoraCorrida: false,
        esDiaLibre: false,
        actividades: [
          {
            descripcion: "Normal 9h",
            esExtra: false,
            job: { codigo: "101" },
            duracionHoras: 4,
          },
          {
            descripcion: "Normal 9h",
            esExtra: false,
            job: { codigo: "102" },
            duracionHoras: 3,
          },
          {
            descripcion: "Normal 9h",
            esExtra: false,
            job: { codigo: "103" },
            duracionHoras: 2,
          },
          {
            descripcion: "Extra 00-07",
            esExtra: true,
            horaInicio: makeDateUTC(fecha, "06:00"),
            horaFin: makeDateUTC(fecha, "13:00"),
            job: { codigo: "100" },
          },
        ],
      });
      break;

    case "2025-09-17":
      p.seedRegistro(fecha, {
        fecha,
        horaEntrada: makeDateUTC(fecha, "13:00"),
        horaSalida: makeDateUTC(fecha, "23:00"),
        esHoraCorrida: false,
        esDiaLibre: false,
        actividades: [
          {
            descripcion: "Normal 9h",
            esExtra: false,
            job: { codigo: "100" },
            duracionHoras: 9,
          },
          {
            descripcion: "Extra 02-07",
            esExtra: true,
            horaInicio: makeDateUTC(fecha, "08:00"),
            horaFin: makeDateUTC(fecha, "13:00"),
            job: { codigo: "105" },
          },
        ],
      });
      break;

    case "2025-09-18":
      p.seedRegistro(fecha, {
        fecha,
        horaEntrada: makeDateUTC(fecha, "13:00"),
        horaSalida: makeDateUTC(fecha, "22:00"),
        esHoraCorrida: true,
        esDiaLibre: false,
        actividades: [
          {
            descripcion: "Normal 9h",
            esExtra: false,
            job: { codigo: "100" },
            duracionHoras: 9,
          },
          {
            descripcion: "Extra 03-07",
            esExtra: true,
            horaInicio: makeDateUTC(fecha, "08:45"),
            horaFin: makeDateUTC(fecha, "13:00"),
            job: { codigo: "101" },
          },
          {
            descripcion: "Extra 16-19",
            esExtra: true,
            horaInicio: makeDateUTC(fecha, "22:00"),
            horaFin: makeDateUTC("2025-09-19", "01:00"),
            job: { codigo: "101" },
          },
        ],
      });
      break;

    case "2025-09-19":
      p.seedFeriado(fecha, true);
      p.seedRegistro(fecha, {
        fecha,
        horaEntrada: makeDateUTC(fecha, "13:00"),
        horaSalida: makeDateUTC(fecha, "13:00"),
        esHoraCorrida: false,
        esDiaLibre: true,
        horasFeriado: 9,
        actividades: [
          {
            descripcion: "Extra 08-12",
            esExtra: true,
            horaInicio: makeDateUTC(fecha, "08:00"),
            horaFin: makeDateUTC(fecha, "12:00"),
            job: { codigo: "100" },
          },
        ],
      });
      break;

    case "2025-09-20":
      p.seedFeriado(fecha, true);
      p.seedRegistro(fecha, {
        fecha,
        horaEntrada: makeDateUTC(fecha, "13:00"),
        horaSalida: makeDateUTC(fecha, "13:00"),
        esHoraCorrida: false,
        esDiaLibre: true,
        horasFeriado: 9,
        actividades: [],
      });
      break;

    default:
      throw new Error(`Fecha no soportada en fixtures: ${fecha}`);
  }
}

// =============================================================================
//  Helpers para pruebas de compensatorias
// =============================================================================

/** Verifica que horasCompensatoriasTomadas y horasCompensatoriasDevueltasPorJob
 *  coincidan con lo esperado e imprime una tabla de diferencias si hay error. */
function assertCompensatorios(
  got: {
    horasCompensatoriasTomadas?: number;
    horasCompensatoriasDevueltasPorJob?: HorasPorJob[];
  },
  exp: {
    horasCompensatoriasTomadas: number;
    horasCompensatoriasDevueltasPorJob: HorasPorJob[];
  }
) {
  const gotTomadas = got.horasCompensatoriasTomadas ?? 0;
  const gotDevueltas = got.horasCompensatoriasDevueltasPorJob ?? [];
  const expDevueltas = exp.horasCompensatoriasDevueltasPorJob;

  const tomOk = Math.abs(gotTomadas - exp.horasCompensatoriasTomadas) < 0.0001;
  const devOk =
    toIndex(gotDevueltas).size === toIndex(expDevueltas).size &&
    [...toIndex(expDevueltas).entries()].every(
      ([cod, h]) => Math.abs((toIndex(gotDevueltas).get(cod) ?? 0) - h) < 0.0001
    );

  if (!tomOk || !devOk) {
    const devueltasRows = [...new Set([
      ...toIndex(expDevueltas).keys(),
      ...toIndex(gotDevueltas).keys(),
    ])].sort().map((cod) => ({
      job: cod,
      "devueltas✓": Number((toIndex(expDevueltas).get(cod) ?? 0).toFixed(4)),
      "devueltas✗": formatValue(
        Number((toIndex(gotDevueltas).get(cod) ?? 0).toFixed(4)),
        Number((toIndex(expDevueltas).get(cod) ?? 0).toFixed(4))
      ),
    }));

    // eslint-disable-next-line no-console
    console.log("\n▶️ Compensatorias — Esperado vs Obtenido");
    // eslint-disable-next-line no-console
    console.table([
      {
        campo: "horasCompensatoriasTomadas",
        "✓": exp.horasCompensatoriasTomadas,
        "✗": formatValue(gotTomadas, exp.horasCompensatoriasTomadas),
      },
    ]);
    if (devueltasRows.length > 0) {
      // eslint-disable-next-line no-console
      console.table(devueltasRows);
    }
  }

  expect(gotTomadas).toBeCloseTo(exp.horasCompensatoriasTomadas, 6);

  const norm = (arr: HorasPorJob[]) =>
    [...arr]
      .map(({ codigoJob, cantidadHoras }) => ({
        codigoJob,
        cantidadHoras: Number(cantidadHoras.toFixed(4)),
      }))
      .sort((a, b) =>
        a.codigoJob < b.codigoJob ? -1 : a.codigoJob > b.codigoJob ? 1 : 0
      );

  expect(norm(gotDevueltas)).toEqual(norm(expDevueltas));
}

/** =========================
 *     Suite de pruebas
 *  ========================= */
describe("PoliticaH1_1 - Prorrateo por Job (11–20/09/2025) con tablas comparativas", () => {
  const fechas = [
    "2025-09-11",
    "2025-09-12",
    "2025-09-13",
    "2025-09-14",
    "2025-09-15",
    "2025-09-16",
    "2025-09-17",
    "2025-09-18",
    "2025-09-19",
    "2025-09-20",
  ];

  for (const fecha of fechas) {
    it(`${fecha}: prorrateo por job coincide con esperado`, async () => {
      const p = new H1Test();
      // Sembrar datos históricos hasta la fecha actual para que la racha se herede correctamente.
      const idx = fechas.indexOf(fecha);
      for (let i = 0; i <= idx; i++) {
        seedInputForDate(p, fechas[i]);
      }

      const res = await p.getProrrateoHorasPorJobByDateAndEmpleado(
        fecha,
        fecha,
        "1"
      );
      const got = res.cantidadHoras;
      const exp = expectedByDate[fecha];

      logProrrateoAndAssert(fecha, got as any, exp);
    });
  }
});

// =============================================================================
//  Pruebas de horas compensatorias (tomar y devolver)
//  Fechas: 2025-10-06 (lunes) y 2025-10-07 (martes) — H1_1
// =============================================================================

describe("PoliticaH1_1 - Compensatorias: tomar y devolver", () => {
  // --------------------------------------------------------------------------
  //  Día 1 — Lunes 2025-10-06: el empleado TOMA compensatorias durante jornada
  //
  //  Horario H1_1 lunes: 07:00–17:00 (9h laborables)
  //  Actividades:
  //    Act1 – normal, 5h, job 100
  //    Act2 – normal, esCompensatorio=true, 4h, SIN job
  //
  //  Esperado:
  //    normal → job "100": 5h
  //    p25/p50/p75/p100 → vacías
  //    totalHorasLaborables → 9
  //    horasCompensatoriasTomadas → 4h  (sin job, se acumulan en banco)
  //    horasCompensatoriasDevueltasPorJob → []
  // --------------------------------------------------------------------------
  it("2025-10-06 (lunes): tomar 4h compensatorias – job 100 tiene 5h normales", async () => {
    const FECHA = "2025-10-06";
    const p = new H1Test();

    p.seedRegistro(FECHA, {
      fecha: FECHA,
      horaEntrada: makeDateUTC(FECHA, "07:00"),
      horaSalida: makeDateUTC(FECHA, "17:00"),
      esHoraCorrida: false,
      esDiaLibre: false,
      actividades: [
        {
          descripcion: "Trabajo normal job 100",
          esExtra: false,
          esCompensatorio: false,
          job: { codigo: "100", nombre: "100" },
          duracionHoras: 5,
        },
        {
          descripcion: "Compensatorio tomado (sin job)",
          esExtra: false,
          esCompensatorio: true,
          // Sin job: se acumula en banco de compensatorias
          duracionHoras: 4,
        },
      ],
    });

    const res = await p.getProrrateoHorasPorJobByDateAndEmpleado(
      FECHA,
      FECHA,
      "1"
    );
    const got = res.cantidadHoras;

    logProrrateoAndAssert(FECHA, got as any, {
      normal: [
        { jobId: 0, codigoJob: "100", nombreJob: "100", cantidadHoras: 5 },
      ],
      p25: [],
      p50: [],
      p75: [],
      p100: [],
      // Igual que `conteo.cantidadHoras.normal` del período (productivas; sin tomadas)
      totalHorasLaborables: 6,
      // extra=false, compensatorio=true → 4h acumuladas en banco (sin job)
      horasCompensatoriasTomadas: 4,
      // extra=true, compensatorio=true → ninguna en este día
      compDevueltas: [],
    });
  });

  // --------------------------------------------------------------------------
  //  Día 2 — Martes 2025-10-07: el empleado DEVUELVE compensatorias con extras
  //
  //  Horario H1_1 martes: 07:00–17:00 (9h laborables)
  //  Actividades:
  //    Act1 – normal, 5h, job 100
  //    Act2 – normal, 4h, job 200
  //    Act3 – extra, esCompensatorio=true,  17:00–20:00, job 300  (3h devueltas)
  //    Act4 – extra, esCompensatorio=false, 20:00–22:00, job 400  (2h, 75%)
  //
  //  Esperado:
  //    normal → job "100": 5h, job "200": 4h
  //    p25   → job "400": 2h (clasificación conteo; compensatorias devueltas en banda aparte)
  //    p50/p75/p100 → según conteo
  //    totalHorasLaborables → conteo.normal del día
  //    horasCompensatoriasTomadas       → 0
  //    horasCompensatoriasDevueltasPorJob → [{ codigoJob: "300", cantidadHoras: 3 }]
  // --------------------------------------------------------------------------
  it("2025-10-07 (martes): devolver 3h compensatorias job 300, extra 75% 2h job 400", async () => {
    const FECHA_LUN = "2025-10-06";
    const FECHA = "2025-10-07";
    const p = new H1Test();

    // Sembrar lunes para que la racha se herede correctamente
    p.seedRegistro(FECHA_LUN, {
      fecha: FECHA_LUN,
      horaEntrada: makeDateUTC(FECHA_LUN, "07:00"),
      horaSalida: makeDateUTC(FECHA_LUN, "17:00"),
      esHoraCorrida: false,
      esDiaLibre: false,
      actividades: [
        {
          descripcion: "Trabajo normal job 100 – lunes",
          esExtra: false,
          esCompensatorio: false,
          job: { codigo: "100", nombre: "100" },
          duracionHoras: 5,
        },
        {
          descripcion: "Compensatorio tomado – lunes",
          esExtra: false,
          esCompensatorio: true,
          duracionHoras: 4,
        },
      ],
    });

    p.seedRegistro(FECHA, {
      fecha: FECHA,
      horaEntrada: makeDateUTC(FECHA, "07:00"),
      horaSalida: makeDateUTC(FECHA, "17:00"),
      esHoraCorrida: false,
      esDiaLibre: false,
      actividades: [
        {
          descripcion: "Trabajo normal job 100",
          esExtra: false,
          esCompensatorio: false,
          job: { codigo: "100", nombre: "100" },
          duracionHoras: 5,
        },
        {
          descripcion: "Trabajo normal job 200",
          esExtra: false,
          esCompensatorio: false,
          job: { codigo: "200", nombre: "200" },
          duracionHoras: 4,
        },
        {
          // Extra compensatoria: se "paga" al banco, NO se contabiliza como p25/p50/p75/p100
          descripcion: "Compensatorio pagado job 300",
          esExtra: true,
          esCompensatorio: true,
          horaInicio: makeDateUTC(FECHA, "17:00"),
          horaFin: makeDateUTC(FECHA, "20:00"),
          job: { codigo: "300", nombre: "300" },
        },
        {
          // Extra ordinaria nocturna → 75%
          descripcion: "Extra nocturna job 400",
          esExtra: true,
          esCompensatorio: false,
          horaInicio: makeDateUTC(FECHA, "20:00"),
          horaFin: makeDateUTC(FECHA, "22:00"),
          job: { codigo: "400", nombre: "400" },
        },
      ],
    });

    const res = await p.getProrrateoHorasPorJobByDateAndEmpleado(
      FECHA,
      FECHA,
      "1"
    );
    const got = res.cantidadHoras;

    logProrrateoAndAssert(FECHA, got as any, {
      normal: [
        { jobId: 0, codigoJob: "100", nombreJob: "100", cantidadHoras: 5 },
        { jobId: 0, codigoJob: "200", nombreJob: "200", cantidadHoras: 4 },
      ],
      p25: [
        { jobId: 0, codigoJob: "400", nombreJob: "400", cantidadHoras: 2 },
      ],
      p50: [],
      p75: [],
      p100: [],
      totalHorasLaborables: 10,
      // extra=false, compensatorio=true → ninguna en este día
      horasCompensatoriasTomadas: 0,
      // extra=true, compensatorio=true → job 300 devuelve 3h al banco
      compDevueltas: [
        { jobId: 0, codigoJob: "300", nombreJob: "300", cantidadHoras: 3 },
      ],
    });
  });
});
