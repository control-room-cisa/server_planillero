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
  d.setUTCHours(h, m, 0, 0);
  return d;
}

describe("PoliticaH1 - Casos 11–15/09/2025 (actualizados)", () => {
  it.skip("11/09/2025: pendiente de revisión", async () => {});

  // 12/09: almuerzo=1, normal=9, p25=0, p50=3, p75=6, p100=0
  it("12/09/2025: extras 03-07 y 17-22 (mixta tras 3h)", async () => {
    const fecha = "2025-09-12";
    const p = new H1Test();

    p.seedRegistro(fecha, {
      fecha,
      horaEntrada: makeDateUTC(fecha, "13:00"),
      horaSalida: makeDateUTC(fecha, "23:00"),
      esHoraCorrida: false,
      esDiaLibre: false,
      actividades: [
        {
          descripcion: "N1",
          job: { codigo: "100" },
          esExtra: false,
          duracionHoras: 1,
        },
        {
          descripcion: "N2",
          job: { codigo: "100" },
          esExtra: false,
          duracionHoras: 5,
        },
        {
          descripcion: "N3",
          job: { codigo: "100" },
          esExtra: false,
          duracionHoras: 3,
        },
        // 03–07 local
        {
          esExtra: true,
          descripcion: "Extra 03-07",
          horaInicio: makeDateUTC(fecha, "09:00"),
          horaFin: makeDateUTC(fecha, "13:00"),
          job: { codigo: "100" },
        },
        // 17–22 local
        {
          esExtra: true,
          descripcion: "Extra 17-22",
          horaInicio: makeDateUTC(fecha, "23:00"),
          horaFin: makeDateUTC("2025-09-13", "04:00"),
          job: { codigo: "100" },
        },
      ],
    });

    const res = await p.getConteoHorasTrabajajadasByDateAndEmpleado(
      fecha,
      fecha,
      "1"
    );
    expect(res.cantidadHoras.almuerzo).toBe(1);
    expect(res.cantidadHoras.normal).toBe(9);
    expect(res.cantidadHoras.p25).toBe(0);
    expect(res.cantidadHoras.p50).toBe(3);
    expect(res.cantidadHoras.p75).toBe(6);
    expect(res.cantidadHoras.p100).toBe(0);
  });

  // 13/09: Sábado. Se inicia nocturna (01–04) 50%; hay interrupción a las 12:00 (LIBRE),
  // se reinicia racha a 25% y se acumula hasta quedar: p25=3h, p50=3h, p75=5h (total 11h extra).
  it("13/09/2025: sábado con interrupción a las 12:00 ⇒ 25=3h, 50=3h, 75=4h", async () => {
    const fecha = "2025-09-13";
    const p = new H1Test();

    p.seedRegistro(fecha, {
      fecha,
      // sin ventana normal (0h)
      horaEntrada: makeDateUTC(fecha, "13:00"),
      horaSalida: makeDateUTC(fecha, "13:00"),
      esHoraCorrida: false,
      esDiaLibre: true,
      actividades: [
        // Bloque 1: 01–04 local → 3h nocturna (p50)
        {
          esExtra: true,
          descripcion: "01-04",
          horaInicio: makeDateUTC(fecha, "07:00"),
          horaFin: makeDateUTC(fecha, "10:00"),
          job: { codigo: "100" },
        },
        // Interrupción a las 12:00 (LIBRE de 12:00 en adelante si no hay extra)
        // Bloque 2: 12–20 local → 8h diurna, reinicia racha: 3h p25 + 5h p75
        {
          esExtra: true,
          descripcion: "12-20",
          horaInicio: makeDateUTC(fecha, "18:00"),
          horaFin: makeDateUTC(fecha, "26:00"),
          job: { codigo: "100" },
        },
      ],
    });

    const res = await p.getConteoHorasTrabajajadasByDateAndEmpleado(
      fecha,
      fecha,
      "1"
    );
    expect(res.cantidadHoras.normal).toBe(0);
    expect(res.cantidadHoras.almuerzo).toBe(0);
    expect(res.cantidadHoras.p25).toBe(3);
    expect(res.cantidadHoras.p50).toBe(3);
    expect(res.cantidadHoras.p75).toBe(4);
    expect(res.cantidadHoras.p100).toBe(0);
  });

  // 14/09: feriado/dominical, extra 16–24 → p100=8
  it("14/09/2025: feriado, extra 16-24 ⇒ p100=8", async () => {
    const fecha = "2025-09-14";
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
          esExtra: true,
          descripcion: "16-24",
          horaInicio: makeDateUTC(fecha, "22:00"),
          horaFin: makeDateUTC("2025-09-15", "06:00"),
          job: { codigo: "100" },
        },
      ],
    });

    const res = await p.getConteoHorasTrabajajadasByDateAndEmpleado(
      fecha,
      fecha,
      "1"
    );
    expect(res.cantidadHoras.almuerzo).toBe(0);
    expect(res.cantidadHoras.normal).toBe(0);
    expect(res.cantidadHoras.p25).toBe(0);
    expect(res.cantidadHoras.p50).toBe(0);
    expect(res.cantidadHoras.p75).toBe(0);
    expect(res.cantidadHoras.p100).toBe(8);
  });

  // 15/09: arrastre dominical hasta 07:00 ⇒ p100=7, más 9h normal y 1h almuerzo
  it("15/09/2025: continuación de domingo 14 ⇒ p100=7", async () => {
    const fecha = "2025-09-15";
    const p = new H1Test();

    // Sembrar domingo 14: 16–24
    p.seedFeriado("2025-09-14", true);
    p.seedRegistro("2025-09-14", {
      fecha: "2025-09-14",
      horaEntrada: makeDateUTC("2025-09-14", "13:00"),
      horaSalida: makeDateUTC("2025-09-14", "13:00"),
      esHoraCorrida: false,
      esDiaLibre: true,
      actividades: [
        {
          esExtra: true,
          descripcion: "16-24",
          horaInicio: makeDateUTC("2025-09-14", "22:00"),
          horaFin: makeDateUTC("2025-09-15", "06:00"),
          job: { codigo: "100" },
        },
      ],
    });

    // Lunes 15: 00–07 extra continua + 9h normal (07–17) con 1h almuerzo
    p.seedRegistro(fecha, {
      fecha,
      horaEntrada: makeDateUTC(fecha, "13:00"),
      horaSalida: makeDateUTC(fecha, "23:00"),
      esHoraCorrida: false,
      esDiaLibre: false,
      actividades: [
        {
          esExtra: true,
          descripcion: "00-07",
          horaInicio: makeDateUTC(fecha, "06:00"),
          horaFin: makeDateUTC(fecha, "13:00"),
          job: { codigo: "100" },
        },
        {
          esExtra: false,
          descripcion: "Normal 9h",
          job: { codigo: "100" },
          duracionHoras: 9,
        },
      ],
    });

    const res = await p.getConteoHorasTrabajajadasByDateAndEmpleado(
      fecha,
      fecha,
      "1"
    );
    expect(res.cantidadHoras.almuerzo).toBe(1);
    expect(res.cantidadHoras.normal).toBe(9);
    expect(res.cantidadHoras.p25).toBe(0);
    expect(res.cantidadHoras.p50).toBe(0);
    expect(res.cantidadHoras.p75).toBe(0);
    expect(res.cantidadHoras.p100).toBe(7);
  });
});
