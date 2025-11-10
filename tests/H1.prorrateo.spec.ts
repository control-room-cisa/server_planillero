import { describe, it, expect } from "vitest";
import { PoliticaH1 } from "../src/domain/calculo-horas/politicas-horario/H1";

/** =========================
 *   Stubs / helpers comunes
 *  ========================= */
class H1Test extends PoliticaH1 {
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

// Unión de todos los jobs usados en el día (en cualquier banda)
function allJobsOfDay(exp: {
  normal: HorasPorJob[];
  p25: HorasPorJob[];
  p50: HorasPorJob[];
  p75: HorasPorJob[];
  p100: HorasPorJob[];
}) {
  const s = new Set<string>();
  [exp.normal, exp.p25, exp.p50, exp.p75, exp.p100].forEach((arr) =>
    arr.forEach((j) => s.add(j.codigoJob))
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
function rowsWideByJob(
  gotBands: {
    normal: HorasPorJob[];
    p25: HorasPorJob[];
    p50: HorasPorJob[];
    p75: HorasPorJob[];
    p100: HorasPorJob[];
  },
  expBands: {
    normal: HorasPorJob[];
    p25: HorasPorJob[];
    p50: HorasPorJob[];
    p75: HorasPorJob[];
    p100: HorasPorJob[];
  }
) {
  const expIdx = {
    normal: toIndex(expBands.normal),
    p25: toIndex(expBands.p25),
    p50: toIndex(expBands.p50),
    p75: toIndex(expBands.p75),
    p100: toIndex(expBands.p100),
  };
  const gotIdx = {
    normal: toIndex(gotBands.normal ?? []),
    p25: toIndex(gotBands.p25 ?? []),
    p50: toIndex(gotBands.p50 ?? []),
    p75: toIndex(gotBands.p75 ?? []),
    p100: toIndex(gotBands.p100 ?? []),
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

    return {
      job: codigo,
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

  rows.push({
    job: "TOTAL",
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
    totalHorasLaborables: number;
    horasFeriado?: number;
  },
  exp: {
    normal: HorasPorJob[];
    p25: HorasPorJob[];
    p50: HorasPorJob[];
    p75: HorasPorJob[];
    p100: HorasPorJob[];
    totalHorasLaborables: number;
    horasFeriado?: number;
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
  if (!assertBandEqual(got.normal ?? [], exp.normal)) return true;
  if (!assertBandEqual(got.p25 ?? [], exp.p25)) return true;
  if (!assertBandEqual(got.p50 ?? [], exp.p50)) return true;
  if (!assertBandEqual(got.p75 ?? [], exp.p75)) return true;
  if (!assertBandEqual(got.p100 ?? [], exp.p100)) return true;

  return false;
}

// Mantén tus asserts banda a banda; sólo cambiamos el logger:
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
    deduccionesComida: number;
    deduccionesIHSS: number;
    Prestamo: number;
    Total: number;
  },
  exp: {
    normal: HorasPorJob[];
    p25: HorasPorJob[];
    p50: HorasPorJob[];
    p75: HorasPorJob[];
    p100: HorasPorJob[];
    totalHorasLaborables: number;
    horasFeriado?: number;
  }
) {
  // Verificar si hay diferencias antes de imprimir
  const hasDiff = hasDifferences(
    {
      normal: got.normal ?? [],
      p25: got.p25 ?? [],
      p50: got.p50 ?? [],
      p75: got.p75 ?? [],
      p100: got.p100 ?? [],
      totalHorasLaborables: got.totalHorasLaborables ?? 0,
      horasFeriado: got.horasFeriado ?? 0,
    },
    exp
  );

  const shouldLogDetails = hasDiff || (exp.horasFeriado ?? 0) > 0;

  // Solo imprimir si hay diferencias o queremos revisar feriados
  if (shouldLogDetails) {
    // 1) Tabla ancha, una fila por job del día (aunque tenga 0s en alguna banda)
    const wide = rowsWideByJob(
      {
        normal: got.normal ?? [],
        p25: got.p25 ?? [],
        p50: got.p50 ?? [],
        p75: got.p75 ?? [],
        p100: got.p100 ?? [],
      },
      {
        normal: exp.normal,
        p25: exp.p25,
        p50: exp.p50,
        p75: exp.p75,
        p100: exp.p100,
      }
    );

    // eslint-disable-next-line no-console
    console.log(`\n▶️ ${fecha} — Prorrateo por Job (Esperado vs Obtenido)`);
    // eslint-disable-next-line no-console
    console.table(wide);

    // 2) Resumen total diario y totalHorasLaborables
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
    ]);
  }

  // 3) Asserts (igual que antes)
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
  expect(got.vacacionesHoras).toBe(0);
  expect(got.permisoConSueldoHoras).toBe(0);
  expect(got.permisoSinSueldoHoras).toBe(0);
  expect(got.inasistenciasHoras).toBe(0);
  expect(got.deduccionesISR).toBe(0);
  expect(got.deduccionesRAP).toBe(0);
  expect(got.deduccionesComida).toBe(0);
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

/** =========================
 *     Suite de pruebas
 *  ========================= */
describe("PoliticaH1 - Prorrateo por Job (11–20/09/2025) con tablas comparativas", () => {
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
