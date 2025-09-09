import { describe, it, expect } from "vitest";
import { PoliticaH1 } from "../../../../src/domain/calculo-horas/politicas-horario/H1";
import type { Segmento15 } from "../../../../src/domain/calculo-horas/politicas-horario/segmentador";

// Helpers ---------------------------------------------------------------
const seg = (
  inicio: string,
  fin: string,
  tipo: "NORMAL" | "ALMUERZO" | "EXTRA" | "LIBRE",
  jobCodigo?: string
): Segmento15 => ({ inicio, fin, tipo, jobCodigo });

const fullLibre = (): Segmento15[] => [seg("00:00", "24:00", "LIBRE")];

// Testable subclass that stubs data sources ---------------------------------
class PoliticaH1Testable extends PoliticaH1 {
  constructor(
    private data: {
      segmentsByDate?: Record<string, Segmento15[]>;
      feriados?: Record<string, string>; // fecha -> nombre
      empleados?: Set<string>; // IDs válidos
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

  async generarSegmentosDeDiaConValidacion(fecha: string, _empleadoId: string) {
    const segmentos = this.data.segmentsByDate?.[fecha] ?? fullLibre();
    return {
      segmentos,
      errores: [],
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

// -----------------------------------------------------------------------------
// Direct tests for private/static helpers (accessed via any) to push coverage
// -----------------------------------------------------------------------------
describe("PoliticaH1 helpers", () => {
  it("HHMM_TO_MIN, segDurMin, isDiurna, addDays, daysInclusive, minutosAhoras", () => {
    const HHMM_TO_MIN = (PoliticaH1 as any).HHMM_TO_MIN as (s: string) => number;
    const segDurMin = (PoliticaH1 as any).segDurMin as (s: Segmento15) => number;
    const isDiurna = (PoliticaH1 as any).isDiurna as (s: Segmento15) => boolean;
    const addDays = (PoliticaH1 as any).addDays as (iso: string, d: number) => string;
    const daysInclusive = (PoliticaH1 as any).daysInclusive as (a: string, b: string) => number;
    const minutosAhoras = (PoliticaH1 as any).minutosAhoras as (m: number) => number;

    expect(HHMM_TO_MIN("05:30")).toBe(330);
    expect(segDurMin(seg("05:00", "06:30", "EXTRA"))).toBe(90);
    expect(isDiurna(seg("05:00", "05:15", "EXTRA"))).toBe(true);
    expect(isDiurna(seg("19:00", "19:15", "EXTRA"))).toBe(false);
    expect(addDays("2025-01-31", 1)).toBe("2025-02-01");
    expect(daysInclusive("2025-01-01", "2025-01-03")).toBe(3);
    expect(minutosAhoras(135)).toBe(2.25);
  });

  it("rachaEsMixta y aplicarExtraSlot (p25/p50/p75 y p100)", () => {
    const rachaEsMixta = (PoliticaH1 as any).rachaEsMixta as (r: any) => boolean;
    const aplicarExtraSlot = (PoliticaH1 as any).aplicarExtraSlot as (
      esDomOFest: boolean,
      esDiurna: boolean,
      r: any,
      b: any
    ) => void;

    const nuevaRacha = () => ({ minutosExtraAcum: 0, vistoDiurna: false, vistoNocturna: false, piso: 0 });
    const buckets = () => ({
      normalMin: 0,
      almuerzoMin: 0,
      libreMin: 0,
      extraC1Min: 0,
      extraC2Min: 0,
      extraC3Min: 0,
      extraC4Min: 0,
      incapacidadMin: 0,
      vacacionesMin: 0,
      permisoConSueldoMin: 0,
      permisoSinSueldoMin: 0,
      compensatorioMin: 0,
    });

    // p25 diurna simple
    let r = nuevaRacha();
    let b = buckets();
    for (let i = 0; i < 4; i++) aplicarExtraSlot(false, true, r, b); // 1h diurna extra
    expect(b.extraC1Min).toBe(60); // p25
    expect(r.piso).toBe(1.25);
    expect(rachaEsMixta(r)).toBe(false);

    // p50 nocturna simple
    r = nuevaRacha();
    b = buckets();
    for (let i = 0; i < 4; i++) aplicarExtraSlot(false, false, r, b);
    expect(b.extraC2Min).toBe(60); // p50
    expect(r.piso).toBe(1.5);
    expect(rachaEsMixta(r)).toBe(false);

    // p100 dominical/festivo (arrastra piso)
    r = nuevaRacha();
    b = buckets();
    aplicarExtraSlot(true, false, r, b); // 15m nocturna en dom/fest
    expect(b.extraC4Min).toBe(15);
    expect(r.piso).toBe(1.5); // fija piso según franja

    // Mixta: 3h acumuladas y ambas franjas vistas
    r = nuevaRacha();
    b = buckets();
    // 3h nocturna
    for (let i = 0; i < 12; i++) aplicarExtraSlot(false, false, r, b);
    expect(rachaEsMixta(r)).toBe(false); // aún no, falta ver diurna
    // primera diurna (activa vistoDiurna pero aún p50 en ese slot)
    aplicarExtraSlot(false, true, r, b);
    // ahora ya es mixta para los siguientes slots
    for (let i = 0; i < 3; i++) aplicarExtraSlot(false, true, r, b);
    expect(b.extraC2Min).toBe(195); // 180 noct + 15 primera diurna
    expect(b.extraC3Min).toBe(45); // restantes 45m como p75
    expect(rachaEsMixta(r)).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// Public API tests for getHorarioTrabajoByDateAndEmpleado
// -----------------------------------------------------------------------------
describe("PoliticaH1.getHorarioTrabajoByDateAndEmpleado", () => {
  it("valida formato de fecha y existencia de empleado", async () => {
    const h1 = new PoliticaH1Testable({ empleados: new Set(["1"]) });
    await expect(h1.getHorarioTrabajoByDateAndEmpleado("2025/01/01", "1")).rejects.toThrow(/Formato de fecha/);
    const h1b = new PoliticaH1Testable({ empleados: new Set(["2"]) });
    await expect(h1b.getHorarioTrabajoByDateAndEmpleado("2025-01-06", "1")).rejects.toThrow(/Empleado/);
  });

  it("Lunes a Jueves: 07:00-17:00, con almuerzo, 9h", async () => {
    const h1 = new PoliticaH1Testable({ empleados: new Set(["1"]) });
    const r = await h1.getHorarioTrabajoByDateAndEmpleado("2025-01-06", "1"); // Lunes
    expect(r.horarioTrabajo).toEqual({ inicio: "07:00", fin: "17:00" });
    expect(r.incluyeAlmuerzo).toBe(true);
    expect(r.cantidadHorasLaborables).toBe(9);
    expect(r.esDiaLibre).toBe(false);
  });

  it("Viernes: 07:00-16:00, con almuerzo, 8h", async () => {
    const h1 = new PoliticaH1Testable({ empleados: new Set(["1"]) });
    const r = await h1.getHorarioTrabajoByDateAndEmpleado("2025-01-10", "1"); // Viernes
    expect(r.horarioTrabajo).toEqual({ inicio: "07:00", fin: "16:00" });
    expect(r.incluyeAlmuerzo).toBe(true);
    expect(r.cantidadHorasLaborables).toBe(8);
    expect(r.esDiaLibre).toBe(false);
  });

  it("Sábado: 0h, sin almuerzo, no libre", async () => {
    const h1 = new PoliticaH1Testable({ empleados: new Set(["1"]) });
    const r = await h1.getHorarioTrabajoByDateAndEmpleado("2025-01-11", "1"); // Sábado
    expect(r.horarioTrabajo).toEqual({ inicio: "07:00", fin: "07:00" });
    expect(r.incluyeAlmuerzo).toBe(false);
    expect(r.cantidadHorasLaborables).toBe(0);
    expect(r.esDiaLibre).toBe(false);
  });

  it("Domingo: día libre", async () => {
    const h1 = new PoliticaH1Testable({ empleados: new Set(["1"]) });
    const r = await h1.getHorarioTrabajoByDateAndEmpleado("2025-01-12", "1"); // Domingo
    expect(r.esDiaLibre).toBe(true);
    expect(r.cantidadHorasLaborables).toBe(0);
  });

  it("Feriado no domingo: 0h, no libre, esFestivo=true", async () => {
    const h1 = new PoliticaH1Testable({ empleados: new Set(["1"]) , feriados: { "2025-01-06": "Feriado" }});
    const r = await h1.getHorarioTrabajoByDateAndEmpleado("2025-01-06", "1");
    expect(r.esFestivo).toBe(true);
    expect(r.esDiaLibre).toBe(false);
    expect(r.cantidadHorasLaborables).toBe(0);
    expect(r.horarioTrabajo).toEqual({ inicio: "07:00", fin: "07:00" });
  });
});

// -----------------------------------------------------------------------------
// Public API tests for conteo de horas (incluye cuadre y buckets especiales)
// -----------------------------------------------------------------------------
describe("PoliticaH1.getConteoHorasTrabajajadasByDateAndEmpleado", () => {
  it("valida fechas y rango", async () => {
    const h1 = new PoliticaH1Testable();
    await expect(h1.getConteoHorasTrabajajadasByDateAndEmpleado("2025/01/01", "2025-01-01", "1")).rejects.toThrow(/Formato de fecha/);
    await expect(h1.getConteoHorasTrabajajadasByDateAndEmpleado("2025-01-02", "2025-01-01", "1")).rejects.toThrow(/fin < inicio/);
  });

  it("día típico: 9h normal, 1h almuerzo, resto libre", async () => {
    const segmentsByDate: Record<string, Segmento15[]> = {
      "2025-01-06": [
        seg("00:00", "07:00", "LIBRE"),
        seg("07:00", "12:00", "NORMAL"),
        seg("12:00", "13:00", "ALMUERZO"),
        seg("13:00", "17:00", "NORMAL"),
        seg("17:00", "24:00", "LIBRE"),
      ],
    };
    const h1 = new PoliticaH1Testable({ segmentsByDate, empleados: new Set(["1"]) });
    const r = await h1.getConteoHorasTrabajajadasByDateAndEmpleado("2025-01-06", "2025-01-06", "1");
    expect(r.cantidadHoras.normal).toBe(9);
    expect(r.cantidadHoras.almuerzo).toBe(1);
    expect(r.cantidadHoras.libre).toBe(14);
    expect(r.cantidadHoras.p25).toBe(0);
    expect(r.cantidadHoras.p50).toBe(0);
    expect(r.cantidadHoras.p75).toBe(0);
    expect(r.cantidadHoras.p100).toBe(0);
  });

  it("lanza por cuadre cuando hay normales especiales E01..E05 (regla actual)", async () => {
    const segmentsByDate: Record<string, Segmento15[]> = {
      "2025-01-07": [
        seg("00:00", "07:00", "LIBRE"),
        seg("07:00", "09:00", "NORMAL", "E02"), // vacaciones 2h
        seg("09:00", "10:00", "NORMAL", "E01"), // incapacidad 1h
        seg("10:00", "12:00", "NORMAL"), // normal 2h
        seg("12:00", "13:00", "ALMUERZO"),
        seg("13:00", "15:00", "NORMAL", "E03"), // permiso con sueldo 2h
        seg("15:00", "16:00", "NORMAL", "E04"), // permiso sin sueldo 1h
        seg("16:00", "17:00", "NORMAL", "E05"), // compensatorio 1h
        seg("17:00", "24:00", "LIBRE"),
      ],
    };
    const h1 = new PoliticaH1Testable({ segmentsByDate, empleados: new Set(["1"]) });
    await expect(
      h1.getConteoHorasTrabajajadasByDateAndEmpleado("2025-01-07", "2025-01-07", "1")
    ).rejects.toThrow(/Cuadre inv/);
  });

  it("extra diurna: p25", async () => {
    const segmentsByDate: Record<string, Segmento15[]> = {
      "2025-01-08": [
        seg("00:00", "05:00", "LIBRE"),
        seg("05:00", "06:00", "EXTRA"), // diurna completa
        seg("06:00", "24:00", "LIBRE"),
      ],
    };
    const h1 = new PoliticaH1Testable({ segmentsByDate });
    const r = await h1.getConteoHorasTrabajajadasByDateAndEmpleado("2025-01-08", "2025-01-08", "1");
    expect(r.cantidadHoras.p25).toBe(1);
    expect(r.cantidadHoras.p50).toBe(0);
    expect(r.cantidadHoras.p75).toBe(0);
    expect(r.cantidadHoras.p100).toBe(0);
  });

  it("extra nocturna: p50", async () => {
    const segmentsByDate: Record<string, Segmento15[]> = {
      "2025-01-09": [
        seg("00:00", "01:00", "EXTRA"), // nocturna
        seg("01:00", "24:00", "LIBRE"),
      ],
    };
    const h1 = new PoliticaH1Testable({ segmentsByDate });
    const r = await h1.getConteoHorasTrabajajadasByDateAndEmpleado("2025-01-09", "2025-01-09", "1");
    expect(r.cantidadHoras.p50).toBe(1);
    expect(r.cantidadHoras.p25).toBe(0);
    expect(r.cantidadHoras.p75).toBe(0);
    expect(r.cantidadHoras.p100).toBe(0);
  });

  it("mixta tras 3h y ambas franjas (día completo extra)", async () => {
    const segmentsByDate: Record<string, Segmento15[]> = {
      "2025-01-10": [
        seg("00:00", "05:00", "EXTRA"), // nocturna 5h (p50)
        seg("05:00", "19:00", "EXTRA"), // diurna 14h (15m p50, 13.75h p75)
        seg("19:00", "24:00", "EXTRA"), // nocturna 5h (p75)
      ],
    };
    const h1 = new PoliticaH1Testable({ segmentsByDate });
    const r = await h1.getConteoHorasTrabajajadasByDateAndEmpleado("2025-01-10", "2025-01-10", "1");
    // 00-05 noct = 5h -> p50 = 5h
    // First 15m of 05-06 diurna under piso 1.5 -> +0.25h p50; rest 0.75h p75
    // 06-19 diurna (13h) p75; 19-24 noct (5h) p75
    expect(r.cantidadHoras.p50).toBe(5.25);
    expect(r.cantidadHoras.p75).toBe(18.75);
    expect(r.cantidadHoras.p25).toBe(0);
    expect(r.cantidadHoras.p100).toBe(0);
    // sumatoria 24h
    expect(
      r.cantidadHoras.p50 + r.cantidadHoras.p75 + r.cantidadHoras.p25 + r.cantidadHoras.p100 + r.cantidadHoras.normal + r.cantidadHoras.almuerzo + r.cantidadHoras.libre
    ).toBe(24);
  });

  it("dominical p100 y arrastre de piso a lunes (en rango 2 días)", async () => {
    const segmentsByDate: Record<string, Segmento15[]> = {
      // Domingo: 23-24 extra (p100), resto libre
      "2025-01-12": [
        seg("00:00", "23:00", "LIBRE"),
        seg("23:00", "24:00", "EXTRA"),
      ],
      // Lunes: 00-05 extra nocturna, 05-06 extra diurna, resto libre
      "2025-01-13": [
        seg("00:00", "05:00", "EXTRA"),
        seg("05:00", "06:00", "EXTRA"),
        seg("06:00", "24:00", "LIBRE"),
      ],
    };
    const feriados = {}; // no feriado; solo domingo
    const h1 = new PoliticaH1Testable({ segmentsByDate, feriados });
    const r = await h1.getConteoHorasTrabajajadasByDateAndEmpleado("2025-01-12", "2025-01-13", "1");
    // Domingo 1h p100
    expect(r.cantidadHoras.p100).toBe(1);
    // Lunes 00-05 p50 = 5h, y 05-06: 0.25h p50 + 0.75h p75
    expect(r.cantidadHoras.p50).toBe(5.25);
    expect(r.cantidadHoras.p75).toBe(0.75);
    // Libre 23h (dom) + 18h (lun) = 41h
    expect(r.cantidadHoras.libre).toBe(41);
  });

  it("cuadre inválido dispara error", async () => {
    const segmentsByDate: Record<string, Segmento15[]> = {
      "2025-01-14": [
        seg("00:00", "01:00", "LIBRE"), // faltan 23h
      ],
    };
    const h1 = new PoliticaH1Testable({ segmentsByDate });
    await expect(
      h1.getConteoHorasTrabajajadasByDateAndEmpleado("2025-01-14", "2025-01-14", "1")
    ).rejects.toThrow(/\[H1\] Cuadre/);
  });
});

// -----------------------------------------------------------------------------
// Cover remaining protected/private methods directly to push function coverage
// -----------------------------------------------------------------------------
describe("PoliticaH1 internals (protected/private)", () => {
  it("covers protected getters", async () => {
    const h1 = new PoliticaH1Testable();
    expect((h1 as any).getHorasLaborablesBase()).toBe(9);
    expect((h1 as any).getHorarioEstandar()).toEqual({ inicio: "07:00", fin: "17:00" });
    expect((h1 as any).incluyeAlmuerzoDefault()).toBe(true);
  });

  it("copiarRacha y sembrarRachaAntesDe", async () => {
    const copiarRacha = (PoliticaH1 as any).copiarRacha as (r: any) => any;
    const r0 = { minutosExtraAcum: 60, vistoDiurna: true, vistoNocturna: false, piso: 1.25 };
    const r1 = copiarRacha(r0);
    expect(r1).toEqual(r0);

    const segmentsByDate: Record<string, Segmento15[]> = {
      // día -2: todo libre
      "2025-01-18": [seg("00:00", "24:00", "LIBRE")],
      // día -1: solo extra diurna hasta el final del día
      "2025-01-19": [
        seg("00:00", "05:00", "LIBRE"),
        seg("05:00", "24:00", "EXTRA"),
      ],
    };
    const h1 = new PoliticaH1Testable({ segmentsByDate });
    const racha = await (h1 as any).sembrarRachaAntesDe("2025-01-20", "1");
    // Debe haber minutos extra acumulados y haber visto diurna por el día -1
    expect(racha.minutosExtraAcum).toBeGreaterThan(0);
    expect(racha.vistoDiurna).toBe(true);
  });

  it("sembrarRachaAntesDe retorna por back===30 cuando no hay LIBRE en lookback", async () => {
    // Generar 30 días previos, todos EXTRA todo el día (sin LIBRE)
    const addDays = (iso: string, d: number) => {
      const [Y, M, D] = iso.split("-").map(Number);
      const dt = new Date(Date.UTC(Y, M - 1, D));
      dt.setUTCDate(dt.getUTCDate() + d);
      const y = dt.getUTCFullYear();
      const m = `${dt.getUTCMonth() + 1}`.padStart(2, "0");
      const day = `${dt.getUTCDate()}`.padStart(2, "0");
      return `${y}-${m}-${day}`;
    };
    const start = "2025-02-01";
    const segmentsByDate: Record<string, Segmento15[]> = {};
    for (let i = -30; i <= -1; i++) {
      const f = addDays(start, i);
      segmentsByDate[f] = [seg("00:00", "24:00", "EXTRA")];
    }
    const h1 = new PoliticaH1Testable({ segmentsByDate });
    const racha = await (h1 as any).sembrarRachaAntesDe(start, "1");
    // Debe acumular muchas horas extra sin haber visto LIBRE
    expect(racha.minutosExtraAcum).toBeGreaterThan(0);
    expect(racha.vistoDiurna || racha.vistoNocturna).toBe(true);
  });
});
