import { describe, it, expect } from "vitest";
import {
  segmentarRegistroDiario,
  type RegistroDiarioLike,
  type Segmento15,
} from "../../../../src/domain/calculo-horas/politicas-horario/segmentador";

// Helper para construir Date en UTC y evitar problemas de zona horaria
function dt(date: string, hhmm: string): Date {
  // ISO con 'Z' -> UTC
  return new Date(`${date}T${hhmm}:00Z`);
}

function makeReg(
  fecha: string,
  inicio: string,
  fin: string,
  opts?: Partial<Pick<RegistroDiarioLike, "esHoraCorrida" | "esDiaLibre" | "actividades">>
): RegistroDiarioLike {
  return {
    fecha,
    horaEntrada: dt(fecha, inicio),
    horaSalida: dt(fecha, fin),
    esHoraCorrida: opts?.esHoraCorrida ?? false,
    esDiaLibre: opts?.esDiaLibre ?? false,
    actividades: opts?.actividades ?? [],
  };
}

function findSeg(segms: Segmento15[], tipo: Segmento15["tipo"], inicio: string, fin: string) {
  return segms.find((s) => s.tipo === tipo && s.inicio === inicio && s.fin === fin);
}

describe("segmentador.ts", () => {
  it("día libre: 1440 min LIBRE y 0 errores", () => {
    const reg = makeReg("2025-01-01", "07:00", "17:00", { esDiaLibre: true });
    const res = segmentarRegistroDiario(reg, { tz: "UTC" });
    expect(res.errores).toHaveLength(0);
    expect(res.totales.minutosLibre).toBe(24 * 60);
    expect(res.totales.minutosNormal).toBe(0);
    expect(res.totales.minutosAlmuerzo).toBe(0);
    expect(res.totales.minutosExtra).toBe(0);
  });

  it("almuerzo aplicado cuando 07:00-17:00 y no hora corrida", () => {
    const reg = makeReg("2025-01-02", "07:00", "17:00");
    const res = segmentarRegistroDiario(reg, { tz: "UTC" });

    // Existe segmento ALMUERZO 12:00-13:00
    expect(findSeg(res.segmentos, "ALMUERZO", "12:00", "13:00")).toBeTruthy();

    // Invariante: RANGO NORMAL == NORMAL + ALMUERZO
    expect(res.totales.minutosRangoNormal).toBe(10 * 60);
    expect(res.totales.minutosNormal + res.totales.minutosAlmuerzo).toBe(10 * 60);

    // Cortes obligatorios se respetan (05:00, 19:00)
    expect(findSeg(res.segmentos, "LIBRE", "00:00", "05:00")).toBeTruthy();
    expect(findSeg(res.segmentos, "LIBRE", "17:00", "19:00")).toBeTruthy();

    expect(res.errores).toHaveLength(0);
  });

  it("no aplica almuerzo con hora corrida", () => {
    const reg = makeReg("2025-01-03", "07:00", "17:00", { esHoraCorrida: true });
    const res = segmentarRegistroDiario(reg, { tz: "UTC" });
    expect(res.totales.minutosAlmuerzo).toBe(0);
    expect(res.totales.minutosNormal).toBe(10 * 60);
    // sin errores por almuerzo
    expect(res.errores.find((e) => e.code.includes("ALMUERZO"))).toBeFalsy();
  });

  it("ALMUERZO_NO_APLICA_POR_RANGO cuando 07:30-11:00 (no cubre 12-13)", () => {
    const reg = makeReg("2025-01-04", "07:30", "11:00");
    const res = segmentarRegistroDiario(reg, { tz: "UTC" });
    const err = res.errores.find((e) => e.code === "ALMUERZO_NO_APLICA_POR_RANGO");
    expect(err).toBeTruthy();
    // Invariante de suma se mantiene
    expect(res.totales.minutosRangoNormal).toBe(210);
    expect(res.totales.minutosNormal + res.totales.minutosAlmuerzo).toBe(210);
  });

  it("EXTRA fuera de normal (19:00-21:00) suma 120 min extra y sin errores", () => {
    const reg = makeReg("2025-01-05", "07:00", "17:00", {
      actividades: [
        {
          horaInicio: dt("2025-01-05", "19:00"),
          horaFin: dt("2025-01-05", "21:00"),
          esExtra: false,
          descripcion: "turno extra",
          jobId: 1,
        },
      ],
    });
    const res = segmentarRegistroDiario(reg, { tz: "UTC" });
    expect(res.totales.minutosExtra).toBe(120);
    // No debe haber EXTRA_DENTRO_DE_NORMAL
    expect(res.errores.find((e) => e.code === "EXTRA_DENTRO_DE_NORMAL")).toBeFalsy();
  });

  it("EXTRA dentro de normal sobre 12:00-13:00: marca error y sobrescribe ALMUERZO", () => {
    const reg = makeReg("2025-01-06", "07:00", "17:00", {
      actividades: [
        {
          horaInicio: dt("2025-01-06", "12:00"),
          horaFin: dt("2025-01-06", "13:00"),
          esExtra: true,
          descripcion: "extra en almuerzo",
          jobId: 2,
        },
      ],
    });
    const res = segmentarRegistroDiario(reg, { tz: "UTC" });

    // Se sobrescribe almuerzo por EXTRA
    expect(findSeg(res.segmentos, "ALMUERZO", "12:00", "13:00")).toBeFalsy();
    expect(findSeg(res.segmentos, "EXTRA", "12:00", "13:00")).toBeTruthy();
    expect(res.totales.minutosExtra).toBeGreaterThanOrEqual(60);

    // Errores esperados
    expect(res.errores.some((e) => e.code === "EXTRA_DENTRO_DE_NORMAL")).toBe(true);
    expect(
      res.errores.some((e) => e.code === "SUMA_NORMAL_MAS_ALMUERZO_NO_COINCIDE")
    ).toBe(true);
  });

  it("rango normal nocturno 19:00-07:00: no hay almuerzo y se marca aviso por no aplicar almuerzo", () => {
    const reg = makeReg("2025-01-07", "19:00", "07:00");
    const res = segmentarRegistroDiario(reg, { tz: "UTC" });
    expect(res.totales.minutosNormal).toBe(12 * 60);
    const err = res.errores.find((e) => e.code === "ALMUERZO_NO_APLICA_POR_RANGO");
    expect(err).toBeTruthy();
  });

  it("actividad NORMAL dentro de rango mantiene ALMUERZO y conserva job en NORMAL", () => {
    const reg = makeReg("2025-01-08", "07:00", "17:00", {
      actividades: [
        {
          horaInicio: dt("2025-01-08", "07:00"),
          horaFin: dt("2025-01-08", "17:00"),
          esExtra: false,
          descripcion: "jornada",
          job: { id: 10, codigo: "N01", nombre: "Normal" },
        },
      ],
    });
    const res = segmentarRegistroDiario(reg, { tz: "UTC" });

    // Almuerzo debe existir aún
    expect(findSeg(res.segmentos, "ALMUERZO", "12:00", "13:00")).toBeTruthy();

    // Algún segmento NORMAL debe tener jobId asignado
    const normalConJob = res.segmentos.find(
      (s) => s.tipo === "NORMAL" && s.jobId === 10
    );
    expect(normalConJob).toBeTruthy();
    expect(normalConJob?.jobCodigo).toBe("N01");
    expect(normalConJob?.jobNombre).toBe("Normal");
  });

  it("entrada == salida: 0h normales, todo LIBRE, sin almuerzo ni errores", () => {
    const reg = makeReg("2025-01-14", "09:00", "09:00");
    const res = segmentarRegistroDiario(reg, { tz: "UTC" });
    expect(res.totales.minutosRangoNormal).toBe(0);
    expect(res.totales.minutosNormal).toBe(0);
    expect(res.totales.minutosAlmuerzo).toBe(0);
    expect(res.totales.minutosLibre).toBe(1440);
    expect(res.errores.length).toBe(0);
  });

  it("corte obligatorio a las 05:00 divide EXTRA 04:45-05:15", () => {
    const reg = makeReg("2025-01-15", "07:00", "17:00", {
      actividades: [
        {
          horaInicio: dt("2025-01-15", "04:45"),
          horaFin: dt("2025-01-15", "05:15"),
          esExtra: true,
          descripcion: "extra amanecer",
          jobId: 5,
        },
      ],
    });
    const res = segmentarRegistroDiario(reg, { tz: "UTC" });
    expect(findSeg(res.segmentos, "EXTRA", "04:45", "05:00")).toBeTruthy();
    expect(findSeg(res.segmentos, "EXTRA", "05:00", "05:15")).toBeTruthy();
  });

  it("actividad sin horaInicio/horaFin se ignora (no afecta totales ni errores)", () => {
    const reg = makeReg("2025-01-16", "07:00", "17:00", {
      actividades: [
        { esExtra: true, descripcion: "incompleta" } as any,
      ],
    });
    const res = segmentarRegistroDiario(reg, { tz: "UTC" });
    // Debe comportarse como un día 07-17 normal con almuerzo 12-13
    expect(res.totales.minutosRangoNormal).toBe(10 * 60);
    expect(res.totales.minutosNormal + res.totales.minutosAlmuerzo).toBe(
      10 * 60
    );
    expect(res.totales.minutosExtra).toBe(0);
    expect(findSeg(res.segmentos, "ALMUERZO", "12:00", "13:00")).toBeTruthy();
    expect(res.errores.length).toBe(0);
  });

  it("entrada/salida no alineadas a 15m generan NORMAL_FUERA_DE_RANGO y desbalance de suma", () => {
    // 07:07-16:53 -> rangosNormal = [07:07,16:53], pero slots NORMAL cubrirán 07:00-17:00
    const reg = makeReg("2025-01-09", "07:07", "16:53");
    const res = segmentarRegistroDiario(reg, { tz: "UTC" });
    // Debe reportar NORMAL_FUERA_DE_RANGO
    expect(res.errores.some((e) => e.code === "NORMAL_FUERA_DE_RANGO")).toBe(
      true
    );
    // Y la suma NORMAL+ALMUERZO != RANGO NORMAL exacto
    const suma = res.totales.minutosNormal + res.totales.minutosAlmuerzo;
    expect(suma).not.toBe(res.totales.minutosRangoNormal);
  });

  it("EXTRA cruzando medianoche (22:00-02:00) se parte en [22:00-24:00] y [00:00-02:00]", () => {
    const fecha = "2025-01-10";
    const reg = makeReg(fecha, "07:00", "17:00", {
      actividades: [
        {
          horaInicio: dt(fecha, "22:00"),
          // fin en el día siguiente para simular cruce real
          horaFin: dt("2025-01-11", "02:00"),
          esExtra: true,
          descripcion: "extra noche",
          jobId: 3,
        },
      ],
    });
    const res = segmentarRegistroDiario(reg, { tz: "UTC" });
    expect(findSeg(res.segmentos, "EXTRA", "22:00", "24:00")).toBeTruthy();
    expect(findSeg(res.segmentos, "EXTRA", "00:00", "02:00")).toBeTruthy();
  });

  it("corte obligatorio a las 19:00 divide un segmento EXTRA 18:45-19:15", () => {
    const reg = makeReg("2025-01-11", "07:00", "17:00", {
      actividades: [
        {
          horaInicio: dt("2025-01-11", "18:45"),
          horaFin: dt("2025-01-11", "19:15"),
          esExtra: true,
          descripcion: "extra borde",
          jobId: 4,
        },
      ],
    });
    const res = segmentarRegistroDiario(reg, { tz: "UTC" });
    expect(findSeg(res.segmentos, "EXTRA", "18:45", "19:00")).toBeTruthy();
    expect(findSeg(res.segmentos, "EXTRA", "19:00", "19:15")).toBeTruthy();
  });

  it("propaga metadatos de job en segmentos EXTRA", () => {
    const reg = makeReg("2025-01-12", "07:00", "17:00", {
      actividades: [
        {
          horaInicio: dt("2025-01-12", "19:00"),
          horaFin: dt("2025-01-12", "20:00"),
          esExtra: true,
          descripcion: "extra con job",
          job: { id: 42, codigo: "E99", nombre: "Prueba" },
        },
      ],
    });
    const res = segmentarRegistroDiario(reg, { tz: "UTC" });
    const seg = findSeg(res.segmentos, "EXTRA", "19:00", "20:00");
    expect(seg?.jobId).toBe(42);
    expect(seg?.jobCodigo).toBe("E99");
    expect(seg?.jobNombre).toBe("Prueba");
    expect(seg?.descripcion).toBe("extra con job");
  });

  it("la suma de minutos por tipo cubre 24h (1440 min) y vienen ordenados", () => {
    const reg = makeReg("2025-01-13", "07:00", "17:00", {
      actividades: [
        { horaInicio: dt("2025-01-13", "05:00"), horaFin: dt("2025-01-13", "06:00"), esExtra: true, descripcion: "x" },
        { horaInicio: dt("2025-01-13", "21:00"), horaFin: dt("2025-01-13", "23:00"), esExtra: true, descripcion: "y" },
      ],
    });
    const res = segmentarRegistroDiario(reg, { tz: "UTC" });

    const sum = res.segmentos.reduce(
      (acc, s) => acc + (Number(s.fin.slice(0, 2)) * 60 + Number(s.fin.slice(3)) - (Number(s.inicio.slice(0, 2)) * 60 + Number(s.inicio.slice(3)))),
      0
    );
    expect(sum).toBe(1440);

    // orden
    const times = res.segmentos.map((s) => s.inicio + ":" + s.fin);
    const sorted = [...times].sort();
    expect(times).toEqual(sorted);
  });
});
