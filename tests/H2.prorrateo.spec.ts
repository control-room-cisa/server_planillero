import { describe, it, expect, vi } from "vitest";
import { PoliticaH2 } from "../src/domain/calculo-horas/politicas-horario/H2";
import { JobRepository } from "../src/repositories/JobRepository";

/** =========================
 *   Stubs / helpers comunes
 *  ========================= */
class H2Test extends PoliticaH2 {
  private registros: Record<string, any> = {};
  private feriados: Record<string, boolean> = {};
  seedRegistro(fecha: string, reg: any) {
    this.registros[fecha] = reg;
  }
  seedFeriado(fecha: string, esFeriado: boolean) {
    this.feriados[fecha] = esFeriado;
  }
  protected async getRegistroDiario(_empleadoId: string, fecha: string) {
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
}

// Mock de JobRepository
vi.mock("../src/repositories/JobRepository", () => ({
  JobRepository: {
    findById: vi.fn(async (id: number) => {
      // Mapeo de jobId a job
      const jobs: Record<number, any> = {
        100: { id: 100, codigo: "100", nombre: "100" },
        101: { id: 101, codigo: "101", nombre: "101" },
      };
      return jobs[id] || null;
    }),
  },
}));

// helper: horas locales (UTC-6) → Date UTC
function makeDateUTC(fecha: string, hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(`${fecha}T00:00:00.000Z`);
  d.setUTCHours(h, m ?? 0, 0, 0);
  return d;
}

// === utilidades ===
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

// Unión de todos los jobs usados en el día
function allJobsOfDay(exp: {
  normal: HorasPorJob[];
  p25: HorasPorJob[];
}) {
  const s = new Set<string>();
  [exp.normal, exp.p25].forEach((arr) =>
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
  },
  expBands: {
    normal: HorasPorJob[];
    p25: HorasPorJob[];
  }
) {
  const expIdx = {
    normal: toIndex(expBands.normal),
    p25: toIndex(expBands.p25),
  };
  const gotIdx = {
    normal: toIndex(gotBands.normal ?? []),
    p25: toIndex(gotBands.p25 ?? []),
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

    return {
      job: codigo,
      "norm✓": eN,
      "norm✗": formatValue(gN, eN),
      "25%✓": e25,
      "25%✗": formatValue(g25, e25),
    };
  });

  // Totales por banda (fila final)
  const totalNormExp = sumHoras(expBands.normal);
  const totalNormGot = sumHoras(gotBands.normal ?? []);
  const total25Exp = sumHoras(expBands.p25);
  const total25Got = sumHoras(gotBands.p25 ?? []);

  rows.push({
    job: "TOTAL",
    "norm✓": totalNormExp,
    "norm✗": formatValue(totalNormGot, totalNormExp),
    "25%✓": total25Exp,
    "25%✗": formatValue(total25Got, total25Exp),
  });

  return rows;
}

// Verifica si hay diferencias antes de imprimir
function hasDifferences(
  got: {
    normal: HorasPorJob[];
    p25: HorasPorJob[];
    totalHorasLaborables: number;
  },
  exp: {
    normal: HorasPorJob[];
    p25: HorasPorJob[];
    totalHorasLaborables: number;
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

  const totalGot = sumHoras(got.normal ?? []) + sumHoras(got.p25 ?? []);
  const totalExp = sumHoras(exp.normal) + sumHoras(exp.p25);

  if (Math.abs(totalGot - totalExp) > 0.0001) return true;
  if (
    Math.abs((got.totalHorasLaborables ?? 0) - exp.totalHorasLaborables) >
    0.0001
  )
    return true;
  if (!assertBandEqual(got.normal ?? [], exp.normal)) return true;
  if (!assertBandEqual(got.p25 ?? [], exp.p25)) return true;

  return false;
}

// Mantén tus asserts banda a banda; sólo cambiamos el logger:
function logProrrateoAndAssert(
  fecha: string,
  got: {
    normal: HorasPorJob[];
    p25: HorasPorJob[];
    totalHorasLaborables: number;
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
  },
  exp: {
    normal: HorasPorJob[];
    p25: HorasPorJob[];
    totalHorasLaborables: number;
  }
) {
  // Verificar si hay diferencias antes de imprimir
  const hasDiff = hasDifferences(
    {
      normal: got.normal ?? [],
      p25: got.p25 ?? [],
      totalHorasLaborables: got.totalHorasLaborables ?? 0,
    },
    exp
  );

  // Solo imprimir si hay diferencias
  if (hasDiff) {
    // Tabla ancha, una fila por job del día
    const wide = rowsWideByJob(
      {
        normal: got.normal ?? [],
        p25: got.p25 ?? [],
      },
      {
        normal: exp.normal,
        p25: exp.p25,
      }
    );

    // eslint-disable-next-line no-console
    console.log(`\n▶️ ${fecha} — Prorrateo por Job H2 (Esperado vs Obtenido)`);
    // eslint-disable-next-line no-console
    console.table(wide);

    // Resumen total diario y totalHorasLaborables
    const totalGot =
      sumHoras(got.normal ?? []) + sumHoras(got.p25 ?? []);
    const totalExp = sumHoras(exp.normal) + sumHoras(exp.p25);

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
    ]);
  }

  // Asserts
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

  const totalGot = sumHoras(got.normal ?? []) + sumHoras(got.p25 ?? []);
  const totalExp = sumHoras(exp.normal) + sumHoras(exp.p25);

  expect(Number(totalGot.toFixed(6))).toBeCloseTo(
    Number(totalExp.toFixed(6)),
    6
  );
  expect(got.totalHorasLaborables).toBeCloseTo(exp.totalHorasLaborables, 6);

  expect(got.vacacionesHoras).toBe(0);
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
  "2025-09-21": {
    normal: [
      { jobId: 0, codigoJob: "101", nombreJob: "101", cantidadHoras: 12 },
    ],
    p25: [{ jobId: 0, codigoJob: "100", nombreJob: "100", cantidadHoras: 4 }],
    totalHorasLaborables: 12,
  },
};

/** =========================
 *    Generador de fixtures
 *  ========================= */
function seedInputForDate(p: H2Test, fecha: string) {
  switch (fecha) {
    case "2025-09-21":
      p.seedRegistro(fecha, {
        fecha,
        horaEntrada: makeDateUTC(fecha, "07:00"),
        horaSalida: makeDateUTC(fecha, "19:00"),
        jornada: "D", // Turno diurno
        esHoraCorrida: true, // H2 siempre es hora corrida
        esDiaLibre: false,
        actividades: [
          {
            descripcion: "Extra 03-07",
            esExtra: true,
            horaInicio: makeDateUTC(fecha, "03:00"),
            horaFin: makeDateUTC(fecha, "07:00"),
            jobId: 100, // Usar jobId directamente
            job: { id: 100, codigo: "100", nombre: "100" }, // También incluir job para compatibilidad
          },
          {
            descripcion: "Normal 07-19",
            esExtra: false,
            jobId: 101, // Usar jobId directamente
            job: { id: 101, codigo: "101", nombre: "101" }, // También incluir job para compatibilidad
            duracionHoras: 12,
          },
        ],
      });
      break;

    default:
      throw new Error(`Fecha no soportada en fixtures: ${fecha}`);
  }
}

/** =========================
 *     Suite de pruebas
 *  ========================= */
describe("PoliticaH2 - Prorrateo por Job con horas extras y normales", () => {
  const fechas = ["2025-09-21"];

  for (const fecha of fechas) {
    it(`${fecha}: prorrateo por job - Extra 03-07 (4h p25) y Normal 07-19 (12h normal)`, async () => {
      const p = new H2Test();
      seedInputForDate(p, fecha);

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

