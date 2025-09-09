import { describe, it, expect } from "vitest";
import { PoliticaH2 } from "../../../../src/domain/calculo-horas/politicas-horario/H2";
import type { Segmento15 } from "../../../../src/domain/calculo-horas/politicas-horario/segmentador";

// Helpers ---------------------------------------------------------------
const seg = (
  inicio: string,
  fin: string,
  tipo: "NORMAL" | "ALMUERZO" | "EXTRA" | "LIBRE"
): Segmento15 => ({ inicio, fin, tipo });

const fullLibre = (): Segmento15[] => [seg("00:00", "24:00", "LIBRE")];

// Stub class focused on conteo with custom segments ---------------------
class PoliticaH2SegmentsStub extends PoliticaH2 {
  constructor(
    private data: {
      empleados?: Set<string>;
      feriados?: Record<string, string>;
      regs?: Record<string, { horaEntrada: Date; horaSalida: Date; esDiaLibre?: boolean; esHoraCorrida?: boolean }>;
      segmentsByDate?: Record<string, Segmento15[]>;
      segmentadorErrors?: Record<string, any[]>;
    } = {}
  ) {
    super();
  }

  protected async getEmpleado(empleadoId: string) {
    if (this.data.empleados && !this.data.empleados.has(empleadoId)) return null as any;
    return { id: Number(empleadoId) } as any;
  }

  protected async esFeriado(fecha: string) {
    const nombre = this.data.feriados?.[fecha];
    return { esFeriado: !!nombre, nombre: nombre ?? "" };
  }

  protected async getRegistroDiario(_empleadoId: string, fecha: string) {
    const r = this.data.regs?.[fecha];
    if (!r) return null as any;
    return {
      fecha,
      horaEntrada: r.horaEntrada,
      horaSalida: r.horaSalida,
      esDiaLibre: r.esDiaLibre ?? false,
      esHoraCorrida: r.esHoraCorrida ?? true,
      actividades: [],
    } as any;
  }

  async generarSegmentosDeDiaConValidacion(fecha: string, _empleadoId: string) {
    const segmentos = this.data.segmentsByDate?.[fecha] ?? fullLibre();
    const errores = this.data.segmentadorErrors?.[fecha] ?? [];
    return {
      segmentos,
      errores,
      totales: {
        minutosRangoNormal: 0,
        minutosNormal: 0,
        minutosAlmuerzo: 0,
        minutosExtra: 0,
        minutosLibre: 0,
      },
    };
  }
}

// Stub that keeps H2's own generarSegmentos logic to cover that method ----
class PoliticaH2RealSeg extends PoliticaH2 {
  constructor(
    private data: {
      empleados?: Set<string>;
      feriados?: Record<string, string>;
      regs?: Record<string, { horaEntrada: Date; horaSalida: Date; esDiaLibre?: boolean; esHoraCorrida?: boolean }>;
    } = {}
  ) {
    super();
  }
  protected async getEmpleado(empleadoId: string) {
    if (this.data.empleados && !this.data.empleados.has(empleadoId)) return null as any;
    return { id: Number(empleadoId) } as any;
  }
  protected async esFeriado(fecha: string) {
    const nombre = this.data.feriados?.[fecha];
    return { esFeriado: !!nombre, nombre: nombre ?? "" };
  }
  protected async getRegistroDiario(_empleadoId: string, fecha: string) {
    const r = this.data.regs?.[fecha];
    if (!r) return null as any;
    return {
      fecha,
      horaEntrada: r.horaEntrada,
      horaSalida: r.horaSalida,
      esDiaLibre: r.esDiaLibre ?? false,
      esHoraCorrida: r.esHoraCorrida ?? false, // forzaremos que H2 lo cambie a true
      actividades: [],
    } as any;
  }
}

// -----------------------------------------------------------------------------
// Private/static helpers
// -----------------------------------------------------------------------------
describe("PoliticaH2 helpers", () => {
  it("hhmmToMin, addDays, dayCountInclusive", () => {
    const hhmmToMin = (PoliticaH2 as any).hhmmToMin as (s: string) => number;
    const addDays = (PoliticaH2 as any).addDays as (iso: string, d: number) => string;
    const dayCountInclusive = (PoliticaH2 as any).dayCountInclusive as (a: string, b: string) => number;

    expect(hhmmToMin("05:30")).toBe(330);
    expect(addDays("2025-01-31", 1)).toBe("2025-02-01");
    expect(addDays("2025-03-01", -1)).toBe("2025-02-28");
    expect(dayCountInclusive("2025-01-01", "2025-01-03")).toBe(3);
  });

  it("minutesOfDayInTZ, normalesDeclaradosMin, esNocturno", () => {
    const minutesOfDayInTZ = (PoliticaH2 as any).minutesOfDayInTZ as (d: Date, tz?: string) => number;
    const normalesDeclaradosMin = (PoliticaH2 as any).normalesDeclaradosMin as (e: Date, s: Date) => number;
    const esNocturno = (PoliticaH2 as any).esNocturno as (e: Date, s: Date) => boolean;

    // Honduras (America/Tegucigalpa) es UTC-6 sin DST
    const d1 = new Date("2025-01-01T07:15:00-06:00");
    expect(minutesOfDayInTZ(d1)).toBe(7 * 60 + 15);

    const eDiurno = new Date("2025-01-01T07:00:00-06:00");
    const sDiurno = new Date("2025-01-01T19:00:00-06:00");
    expect((PoliticaH2 as any).normalesDeclaradosMin.call(PoliticaH2, eDiurno, sDiurno)).toBe(12 * 60);
    expect((PoliticaH2 as any).esNocturno.call(PoliticaH2, eDiurno, sDiurno)).toBe(false);

    const eNoct = new Date("2025-01-01T19:00:00-06:00");
    const sNoct = new Date("2025-01-01T07:00:00-06:00"); // em>sm path
    expect((PoliticaH2 as any).normalesDeclaradosMin.call(PoliticaH2, eNoct, sNoct)).toBe(12 * 60);
    expect((PoliticaH2 as any).esNocturno.call(PoliticaH2, eNoct, sNoct)).toBe(true);

    const eNocheA = new Date("2025-01-01T19:00:00-06:00");
    const sNocheA = new Date("2025-01-01T22:00:00-06:00");
    expect((PoliticaH2 as any).esNocturno.call(PoliticaH2, eNocheA, sNocheA)).toBe(true);

    const eNocheB = new Date("2025-01-01T00:00:00-06:00");
    const sNocheB = new Date("2025-01-01T07:00:00-06:00");
    expect((PoliticaH2 as any).esNocturno.call(PoliticaH2, eNocheB, sNocheB)).toBe(true);

    const eSame = new Date("2025-01-01T08:00:00-06:00");
    const sSame = new Date("2025-01-01T08:00:00-06:00");
    expect((PoliticaH2 as any).normalesDeclaradosMin.call(PoliticaH2, eSame, sSame)).toBe(0);
  });
});

// -----------------------------------------------------------------------------
// getHorarioTrabajoByDateAndEmpleado
// -----------------------------------------------------------------------------
describe("PoliticaH2.getHorarioTrabajoByDateAndEmpleado", () => {
  it("valida formato y existencia de empleado", async () => {
    const h2 = new PoliticaH2SegmentsStub({ empleados: new Set(["1"]) });
    await expect(h2.getHorarioTrabajoByDateAndEmpleado("2025/01/01", "1")).rejects.toThrow(/Formato de fecha/);
    const h2b = new PoliticaH2SegmentsStub({ empleados: new Set(["2"]) });
    await expect(h2b.getHorarioTrabajoByDateAndEmpleado("2025-01-01", "1")).rejects.toThrow(/Empleado/);
  });

  it("sin registro: default 07:00-19:00, sin almuerzo, festivo flag", async () => {
    const h2 = new PoliticaH2SegmentsStub({ empleados: new Set(["1"]), feriados: { "2025-01-01": "F" } });
    const r = await h2.getHorarioTrabajoByDateAndEmpleado("2025-01-01", "1");
    expect(r.horarioTrabajo).toEqual({ inicio: "07:00", fin: "19:00" });
    expect(r.incluyeAlmuerzo).toBe(false);
    expect(r.cantidadHorasLaborables).toBe(12);
    expect(r.esFestivo).toBe(true);
  });

  it("con registro: usa entrada/salida y calcula horas normales", async () => {
    const regs = {
      "2025-01-02": {
        horaEntrada: new Date("2025-01-02T07:00:00-06:00"),
        horaSalida: new Date("2025-01-02T19:00:00-06:00"),
      },
    };
    const h2 = new PoliticaH2SegmentsStub({ empleados: new Set(["1"]), regs });
    const r = await h2.getHorarioTrabajoByDateAndEmpleado("2025-01-02", "1");
    expect(r.horarioTrabajo).toEqual({ inicio: "07:00", fin: "19:00" });
    expect(r.cantidadHorasLaborables).toBe(12);
  });

  it("marca esDiaLibre=true cuando el registro lo indica", async () => {
    const regs = {
      "2025-01-03": {
        horaEntrada: new Date("2025-01-03T00:00:00-06:00"),
        horaSalida: new Date("2025-01-03T00:00:00-06:00"),
        esDiaLibre: true,
      },
    };
    const h2 = new PoliticaH2SegmentsStub({ empleados: new Set(["1"]), regs });
    const r = await h2.getHorarioTrabajoByDateAndEmpleado("2025-01-03", "1");
    expect(r.esDiaLibre).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// Conteo por rango
// -----------------------------------------------------------------------------
describe("PoliticaH2.getConteoHorasTrabajajadasByDateAndEmpleado", () => {
  it("valida fechas y rango", async () => {
    const h2 = new PoliticaH2SegmentsStub();
    await expect(h2.getConteoHorasTrabajajadasByDateAndEmpleado("2025/01/01", "2025-01-01", "1")).rejects.toThrow(/Formato de fecha/);
    await expect(h2.getConteoHorasTrabajajadasByDateAndEmpleado("2025-01-02", "2025-01-01", "1")).rejects.toThrow(/fin < inicio/);
  });

  it("libre sin registro: 24h libre, tipoDia=libre", async () => {
    const h2 = new PoliticaH2SegmentsStub({});
    const r = await h2.getConteoHorasTrabajajadasByDateAndEmpleado("2025-01-03", "2025-01-03", "1");
    expect(r.cantidadHoras.normal).toBe(0);
    expect(r.cantidadHoras.p25).toBe(0);
    expect(r.cantidadHoras.libre).toBe(24);
    expect((r as any).tiposDias[0].tipo).toBe("libre");
  });

  it("libre con registro marcado esDiaLibre=true", async () => {
    const regs = {
      "2025-01-17": { horaEntrada: new Date("2025-01-17T00:00:00-06:00"), horaSalida: new Date("2025-01-17T00:00:00-06:00"), esDiaLibre: true },
    } as const;
    const segmentsByDate = { "2025-01-17": [seg("00:00", "24:00", "LIBRE")] };
    const h2 = new PoliticaH2SegmentsStub({ regs: regs as any, segmentsByDate });
    const r = await h2.getConteoHorasTrabajajadasByDateAndEmpleado("2025-01-17", "2025-01-17", "1");
    expect((r as any).tiposDias[0].tipo).toBe("libre");
  });

  it("festivo con extra: suma p25 y tipoDia=festivo", async () => {
    const segmentsByDate = {
      "2025-01-04": [seg("00:00", "05:00", "LIBRE"), seg("05:00", "07:00", "EXTRA"), seg("07:00", "24:00", "LIBRE")],
    };
    const h2 = new PoliticaH2SegmentsStub({ feriados: { "2025-01-04": "F" }, segmentsByDate });
    const r = await h2.getConteoHorasTrabajajadasByDateAndEmpleado("2025-01-04", "2025-01-04", "1");
    expect(r.cantidadHoras.p25).toBe(2);
    expect((r as any).tiposDias[0].tipo).toBe("festivo");
  });

  it("festivo con almuerzo: error de almuerzo no permitido", async () => {
    const segmentsByDate = {
      "2025-01-05": [
        seg("00:00", "12:00", "LIBRE"),
        seg("12:00", "13:00", "ALMUERZO"),
        seg("13:00", "24:00", "LIBRE"),
      ],
    };
    const h2 = new PoliticaH2SegmentsStub({ feriados: { "2025-01-05": "F" }, segmentsByDate });
    await expect(
      h2.getConteoHorasTrabajajadasByDateAndEmpleado("2025-01-05", "2025-01-05", "1")
    ).rejects.toThrow(/ALMUERZO_NO_PERMITIDO_EN_H2/);
  });

  it("diurno 07-19 normal exacto", async () => {
    const regs = {
      "2025-01-06": { horaEntrada: new Date("2025-01-06T07:00:00-06:00"), horaSalida: new Date("2025-01-06T19:00:00-06:00") },
    };
    const segmentsByDate = {
      "2025-01-06": [
        seg("00:00", "07:00", "LIBRE"),
        seg("07:00", "19:00", "NORMAL"),
        seg("19:00", "24:00", "LIBRE"),
      ],
    };
    const h2 = new PoliticaH2SegmentsStub({ regs, segmentsByDate });
    const r = await h2.getConteoHorasTrabajajadasByDateAndEmpleado("2025-01-06", "2025-01-06", "1");
    expect(r.cantidadHoras.normal).toBe(12);
    expect((r as any).tiposDias[0].tipo).toBe("diurno");
  });

  it("nocturno lunes 19-07 normal 12h", async () => {
    const regs = {
      "2025-01-13": { horaEntrada: new Date("2025-01-13T19:00:00-06:00"), horaSalida: new Date("2025-01-14T07:00:00-06:00") },
    };
    const segmentsByDate = {
      // Nota: para turnos cruzando medianoche, el segmentador representa en el día
      // 00:00-07:00 y 19:00-24:00 como NORMAL en el mismo día.
      "2025-01-13": [
        seg("00:00", "07:00", "NORMAL"),
        seg("07:00", "19:00", "LIBRE"),
        seg("19:00", "24:00", "NORMAL"),
      ],
    };
    const h2 = new PoliticaH2SegmentsStub({ regs, segmentsByDate });
    const r = await h2.getConteoHorasTrabajajadasByDateAndEmpleado("2025-01-13", "2025-01-13", "1");
    expect(r.cantidadHoras.normal).toBe(12);
    expect((r as any).tiposDias[0].tipo).toBe("nocturno");
  });

  it("nocturno martes 19-07: 6h normal exacto", async () => {
    const regs = {
      "2025-01-14": { horaEntrada: new Date("2025-01-14T19:00:00-06:00"), horaSalida: new Date("2025-01-15T07:00:00-06:00") }, // Martes
    };
    const segmentsByDate = {
      // Representación en un solo día: 00-03 y 19-22 NORMAL (6h), resto EXTRA/libre
      "2025-01-14": [
        seg("00:00", "03:00", "NORMAL"),
        seg("03:00", "19:00", "EXTRA"),
        seg("19:00", "22:00", "NORMAL"),
        seg("22:00", "24:00", "EXTRA"),
      ],
    };
    const h2 = new PoliticaH2SegmentsStub({ regs, segmentsByDate });
    const r = await h2.getConteoHorasTrabajajadasByDateAndEmpleado("2025-01-14", "2025-01-14", "1");
    expect(r.cantidadHoras.normal).toBe(6);
    expect(r.cantidadHoras.p25).toBe(18);
  });

  it("almuerzo no permitido provoca error", async () => {
    const regs = {
      "2025-01-07": { horaEntrada: new Date("2025-01-07T07:00:00-06:00"), horaSalida: new Date("2025-01-07T19:00:00-06:00") },
    };
    const segmentsByDate = {
      "2025-01-07": [
        seg("07:00", "12:00", "NORMAL"),
        seg("12:00", "13:00", "ALMUERZO"),
        seg("13:00", "19:00", "NORMAL"),
        seg("19:00", "24:00", "LIBRE"),
      ],
    };
    const h2 = new PoliticaH2SegmentsStub({ regs, segmentsByDate });
    await expect(
      h2.getConteoHorasTrabajajadasByDateAndEmpleado("2025-01-07", "2025-01-07", "1")
    ).rejects.toThrow(/ALMUERZO_NO_PERMITIDO_EN_H2/);
  });

  it("normal no coincide con intervalo provoca error", async () => {
    const regs = {
      "2025-01-08": { horaEntrada: new Date("2025-01-08T07:00:00-06:00"), horaSalida: new Date("2025-01-08T19:00:00-06:00") },
    };
    const segmentsByDate = {
      "2025-01-08": [
        seg("00:00", "07:00", "LIBRE"),
        seg("07:00", "17:00", "NORMAL"), // solo 10h en lugar de 12h
        seg("17:00", "24:00", "LIBRE"),
      ],
    };
    const h2 = new PoliticaH2SegmentsStub({ regs, segmentsByDate });
    await expect(
      h2.getConteoHorasTrabajajadasByDateAndEmpleado("2025-01-08", "2025-01-08", "1")
    ).rejects.toThrow(/NORMAL_NO_COINCIDE_CON_INTERVALO/);
  });

  it("segmento de 0 minutos se ignora (dur===0)", async () => {
    const regs = {
      "2025-01-16": { horaEntrada: new Date("2025-01-16T07:00:00-06:00"), horaSalida: new Date("2025-01-16T19:00:00-06:00") },
    };
    const segmentsByDate = {
      "2025-01-16": [
        seg("00:00", "07:00", "LIBRE"),
        seg("07:00", "07:00", "NORMAL"), // 0 min
        seg("07:00", "19:00", "NORMAL"),
        seg("19:00", "24:00", "LIBRE"),
      ],
    };
    const h2 = new PoliticaH2SegmentsStub({ regs, segmentsByDate });
    const r = await h2.getConteoHorasTrabajajadasByDateAndEmpleado("2025-01-16", "2025-01-16", "1");
    expect(r.cantidadHoras.normal).toBe(12);
  });

  it("feriado con normales provoca error", async () => {
    const segmentsByDate = {
      "2025-01-09": [seg("07:00", "08:00", "NORMAL"), seg("08:00", "24:00", "LIBRE")],
    };
    const h2 = new PoliticaH2SegmentsStub({ feriados: { "2025-01-09": "F" }, segmentsByDate });
    await expect(
      h2.getConteoHorasTrabajajadasByDateAndEmpleado("2025-01-09", "2025-01-09", "1")
    ).rejects.toThrow(/FERIADO_O_LIBRE_CON_NORMAL/);
  });

  it("segmentador devuelve errores: se propagan y lanzan", async () => {
    const segmentadorErrors = { "2025-01-10": [{ code: "X", message: "mock" }] };
    const h2 = new PoliticaH2SegmentsStub({ segmentadorErrors });
    await expect(
      h2.getConteoHorasTrabajajadasByDateAndEmpleado("2025-01-10", "2025-01-10", "1")
    ).rejects.toThrow(/segmentador/);
  });

  it("cuadre global inválido provoca error", async () => {
    const segmentsByDate = { "2025-01-11": [seg("00:00", "01:00", "LIBRE")] };
    const h2 = new PoliticaH2SegmentsStub({ segmentsByDate });
    await expect(
      h2.getConteoHorasTrabajajadasByDateAndEmpleado("2025-01-11", "2025-01-11", "1")
    ).rejects.toThrow(/CUADRE_GLOBAL_INVALIDO/);
  });
});

// -----------------------------------------------------------------------------
// Cover protected getters and H2 segmentador override method
// -----------------------------------------------------------------------------
describe("PoliticaH2 internals", () => {
  it("getters protegidos", () => {
    const h2 = new PoliticaH2SegmentsStub();
    expect((h2 as any).getHorasLaborablesBase()).toBe(12);
    expect((h2 as any).getHorarioEstandar()).toEqual({ inicio: "07:00", fin: "19:00" });
    expect((h2 as any).incluyeAlmuerzoDefault()).toBe(false);
  });

  it("generarSegmentosDeDiaConValidacion: sin registro y con registro", async () => {
    const regs = {
      "2025-01-12": { horaEntrada: new Date("2025-01-12T07:00:00-06:00"), horaSalida: new Date("2025-01-12T19:00:00-06:00"), esDiaLibre: false, esHoraCorrida: false },
    };
    const h2 = new PoliticaH2RealSeg({ regs });
    const sin = await h2.generarSegmentosDeDiaConValidacion("2025-01-13", "1");
    expect(sin.segmentos.length).toBeGreaterThan(0);
    const con = await h2.generarSegmentosDeDiaConValidacion("2025-01-12", "1");
    expect(con.segmentos.length).toBeGreaterThan(0);
  });

  it("generarSegmentosDeDiaConValidacion: formato de fecha inválido", async () => {
    const h2 = new PoliticaH2RealSeg();
    await expect(h2.generarSegmentosDeDiaConValidacion("2025/13/40", "1")).rejects.toThrow(/Formato de fecha/);
  });
});
