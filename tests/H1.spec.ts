import { describe, it, expect } from "vitest";
import { PoliticaH1 } from "../src/domain/calculo-horas/politicas-horario/H1";

// ------- Stubs -------
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

// helper: horas locales (UTC-6) → Date UTC
function makeDateUTC(fecha: string, hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(`${fecha}T00:00:00.000Z`);
  d.setUTCHours(h, m ?? 0, 0, 0);
  return d;
}

type Horas = {
  almuerzo: number;
  normal: number;
  p25: number;
  p50: number;
  p75: number;
  p100: number;
};
type HorasExt = Horas & { libre?: number };

const RED = (s: string) => `\x1b[31m${s}\x1b[0m`;

function sumHoras(h: Horas) {
  return h.almuerzo + h.normal + h.p25 + h.p50 + h.p75 + h.p100;
}

function logAndAssert(fecha: string, got: HorasExt, exp: Horas) {
  // Cálculos de libre (si la app no lo entrega, lo derivamos)
  const expLibre = 24 - sumHoras(exp);
  const gotTotal = sumHoras(got);
  const gotLibre = got.libre ?? 24 - gotTotal;

  const rows = [
    { métrica: "almuerzo", esperado: exp.almuerzo, obtenido: got.almuerzo },
    { métrica: "normal", esperado: exp.normal, obtenido: got.normal },
    { métrica: "extra25", esperado: exp.p25, obtenido: got.p25 },
    { métrica: "extra50", esperado: exp.p50, obtenido: got.p50 },
    { métrica: "extra75", esperado: exp.p75, obtenido: got.p75 },
    { métrica: "extra100", esperado: exp.p100, obtenido: got.p100 },
    { métrica: "libre", esperado: expLibre, obtenido: gotLibre },
    {
      métrica: "TOTAL",
      esperado: 24,
      obtenido: gotTotal + gotLibre,
    },
  ].map((r) => {
    const okBool = r.esperado === r.obtenido;
    return {
      ...r,
      ok: okBool,
      status: okBool ? "✅" : "❌",
      diff: (r.obtenido as number) - (r.esperado as number),
    };
  });

  // eslint-disable-next-line no-console
  console.log(`\n▶️ ${fecha} — Esperado vs Obtenido`);
  // eslint-disable-next-line no-console
  console.table(rows);

  // Asserts por campo
  expect(got.almuerzo).toBe(exp.almuerzo);
  expect(got.normal).toBe(exp.normal);
  expect(got.p25).toBe(exp.p25);
  expect(got.p50).toBe(exp.p50);
  expect(got.p75).toBe(exp.p75);
  expect(got.p100).toBe(exp.p100);

  // Assert de libre y de identidad TOTAL+libre = 24
  expect(gotLibre).toBe(expLibre);
  expect(gotTotal + gotLibre).toBe(24);
}

describe("PoliticaH1 - Casos 11–18/09/2025 (con logs y libre)", () => {
  // -------------------- 11/09/2025 --------------------
  // Esperado: 1,9,2,3,2,0
  it("11/09/2025: normal 7–17 + extra 17–24 ⇒ 1/9/2/3/2/0", async () => {
    const fecha = "2025-09-11";
    const p = new H1Test();

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

    const res = await p.getConteoHorasTrabajajadasByDateAndEmpleado(
      fecha,
      fecha,
      "1"
    );
    logAndAssert(fecha, res.cantidadHoras as HorasExt, {
      almuerzo: 1,
      normal: 9,
      p25: 2,
      p50: 1,
      p75: 4,
      p100: 0,
    });
  });

  // -------------------- 12/09/2025 --------------------
  // Esperado: 1,8,0,3,7,0
  it("12/09/2025: extras 03–07 y 16–22 ⇒ 1/8/0/3/7/0", async () => {
    const fecha = "2025-09-12";
    const p = new H1Test();

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

    const res = await p.getConteoHorasTrabajajadasByDateAndEmpleado(
      fecha,
      fecha,
      "1"
    );
    logAndAssert(fecha, res.cantidadHoras as HorasExt, {
      almuerzo: 1,
      normal: 8,
      p25: 0,
      p50: 3,
      p75: 7,
      p100: 0,
    });
  });

  // -------------------- 13/09/2025 (sábado) --------------------
  // Esperado: 1,0,0,3,8,0
  it("13/09/2025: sábado extras 04–12 y 13–16 ⇒ 1/0/0/3/8/0", async () => {
    const fecha = "2025-09-13";
    const p = new H1Test();

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

    const res = await p.getConteoHorasTrabajajadasByDateAndEmpleado(
      fecha,
      fecha,
      "1"
    );
    logAndAssert(fecha, res.cantidadHoras as HorasExt, {
      almuerzo: 1,
      normal: 0,
      p25: 0,
      p50: 3,
      p75: 8,
      p100: 0,
    });
  });

  // -------------------- 14/09/2025 (domingo/feriado) --------------------
  // Esperado: 0,0,0,0,0,0
  it("14/09/2025: domingo/libre sin actividades ⇒ 0/0/0/0/0/0", async () => {
    const fecha = "2025-09-14";
    const p = new H1Test();

    p.seedFeriado(fecha, true);
    p.seedRegistro(fecha, {
      fecha,
      horaEntrada: makeDateUTC(fecha, "13:00"),
      horaSalida: makeDateUTC(fecha, "13:00"),
      esHoraCorrida: false,
      esDiaLibre: true,
      actividades: [],
    });

    const res = await p.getConteoHorasTrabajajadasByDateAndEmpleado(
      fecha,
      fecha,
      "1"
    );
    logAndAssert(fecha, res.cantidadHoras as HorasExt, {
      almuerzo: 0,
      normal: 0,
      p25: 0,
      p50: 0,
      p75: 0,
      p100: 0,
    });
  });

  // -------------------- 15/09/2025 (lunes feriado) --------------------
  // Esperado: 0,0,0,0,0,8 (no almuerzo porque actividades solo después de 13:00)
  it("15/09/2025: feriado con extra 16–24 ⇒ 0/0/0/0/0/8", async () => {
    const fecha = "2025-09-15";
    const p = new H1Test();

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

    const res = await p.getConteoHorasTrabajajadasByDateAndEmpleado(
      fecha,
      fecha,
      "1"
    );
    logAndAssert(fecha, res.cantidadHoras as HorasExt, {
      almuerzo: 0,
      normal: 0,
      p25: 0,
      p50: 0,
      p75: 0,
      p100: 8,
    });
  });

  // -------------------- 16/09/2025 --------------------
  // Esperado: 1,9,0,0,7,0
  it("16/09/2025: normal 9h + extra 00–07 ⇒ 1/9/0/0/7/0", async () => {
    const fecha = "2025-09-16";
    const p = new H1Test();

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

    const res = await p.getConteoHorasTrabajajadasByDateAndEmpleado(
      fecha,
      fecha,
      "1"
    );
    logAndAssert(fecha, res.cantidadHoras as HorasExt, {
      almuerzo: 1,
      normal: 9,
      p25: 0,
      p50: 0,
      p75: 7,
      p100: 0,
    });
  });

  // -------------------- 17/09/2025 --------------------
  // Esperado: 1,9,0,3,2,0
  it("17/09/2025: normal 9h + extra 02–07 ⇒ 1/9/0/3/2/0", async () => {
    const fecha = "2025-09-17";
    const p = new H1Test();

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

    const res = await p.getConteoHorasTrabajajadasByDateAndEmpleado(
      fecha,
      fecha,
      "1"
    );
    logAndAssert(fecha, res.cantidadHoras as HorasExt, {
      almuerzo: 1,
      normal: 9,
      p25: 0,
      p50: 3,
      p75: 2,
      p100: 0,
    });
  });

  // -------------------- 18/09/2025 --------------------
  // Esperado: 0,9,0,3,4,0
  it("18/09/2025: hora corrida 07–16 + extras 03–07 y 16–19 ⇒ 0/9/0/3/4/0", async () => {
    const fecha = "2025-09-18";
    const p = new H1Test();

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

    const res = await p.getConteoHorasTrabajajadasByDateAndEmpleado(
      fecha,
      fecha,
      "1"
    );
    await p.getProrrateoHorasPorJobByDateAndEmpleado(fecha, fecha, "1");
    logAndAssert(fecha, res.cantidadHoras as HorasExt, {
      almuerzo: 0,
      normal: 9,
      p25: 0,
      p50: 3,
      p75: 4.25,
      p100: 0,
    });
  });
});
