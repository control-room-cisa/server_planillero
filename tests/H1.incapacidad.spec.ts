/**
 * Tests unitarios: cálculo de días de incapacidad con LRM
 *
 * Cubre:
 *  - Clasificación empresa vs IHSS (3 días empresa, 4.° en adelante IHSS)
 *  - Carry-over desde quincena anterior
 *  - Quincenas de 13, 15 y 16 días con LRM
 *  - Múltiples intervalos no consecutivos dentro de una quincena
 */
import { describe, it, expect } from "vitest";
import { PoliticaH1_1 } from "../src/domain/calculo-horas/politicas-horario/H1_1";

// ---------------------------------------------------------------------------
// Stub de la política H1_1 con repositorios en memoria
// ---------------------------------------------------------------------------
class IncapTest extends PoliticaH1_1 {
  private registros: Record<string, any> = {};
  private feriados: Record<string, boolean> = {};

  /** Marca una fecha como día de incapacidad */
  seedIncapacidad(fecha: string) {
    this.registros[fecha] = { fecha, esIncapacidad: true };
  }
  seedFeriado(fecha: string) {
    this.feriados[fecha] = true;
  }

  protected async getRegistroDiario(_id: string, fecha: string) {
    return this.registros[fecha] ?? null;
  }
  protected async esFeriado(fecha: string) {
    return { esFeriado: !!this.feriados[fecha], nombre: "" };
  }
  protected async getEmpleado(_id: string) {
    return { id: 1, nombre: "Test" } as any;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Agrega N días a una fecha YYYY-MM-DD */
function addDays(fecha: string, n: number): string {
  const d = new Date(`${fecha}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split("T")[0];
}

/** Siembra incapacidad en [start, start+days) */
function seedRange(p: IncapTest, start: string, days: number) {
  for (let i = 0; i < days; i++) {
    p.seedIncapacidad(addDays(start, i));
  }
}

/** Función de assert con tabla solo si hay fallos */
function assertIncap(
  label: string,
  conteoDias: NonNullable<
    Awaited<
      ReturnType<IncapTest["getConteoHorasTrabajajadasByDateAndEmpleado"]>
    >["conteoDias"]
  >,
  exp: { empresa: number; ihss: number; diasLaborados: number }
) {
  const rows = [
    {
      métrica: "incapEmpresa",
      esperado: exp.empresa,
      obtenido: conteoDias!.incapacidadEmpresa,
    },
    {
      métrica: "incapIHSS",
      esperado: exp.ihss,
      obtenido: conteoDias!.incapacidadIHSS,
    },
    {
      métrica: "diasLaborados",
      esperado: exp.diasLaborados,
      obtenido: conteoDias!.diasLaborados,
    },
  ].map((r) => ({
    ...r,
    ok: r.esperado === r.obtenido,
    diff: r.obtenido - r.esperado,
  }));

  if (rows.some((r) => !r.ok)) {
    // eslint-disable-next-line no-console
    console.log(`\n▶️ ${label} — Esperado vs Obtenido`);
    // eslint-disable-next-line no-console
    console.table(rows);
  }

  expect(conteoDias!.incapacidadEmpresa).toBe(exp.empresa);
  expect(conteoDias!.incapacidadIHSS).toBe(exp.ihss);
  expect(conteoDias!.diasLaborados).toBe(exp.diasLaborados);
}

// ---------------------------------------------------------------------------
// Suite de tests
// ---------------------------------------------------------------------------
describe("Incapacidad — empresa / IHSS / LRM", () => {
  /**
   * Caso 1: Quincena estándar (15 días), 3 días consecutivos al inicio
   *
   * Sep 1-3 → empresa (no hay incapacidad en Aug 29-31)
   * empresa=[3], IHSS=[]
   * LRM(15 días): 3/15*15 = 3 → empresa=3
   * diasLaborados = 15 - 3 - 0 = 12
   */
  it("Q15: 3 días consecutivos → 3 empresa, 0 IHSS, 12 laborados", async () => {
    const p = new IncapTest();
    seedRange(p, "2025-09-01", 3); // Sep 1-3

    const res = await p.getConteoHorasTrabajajadasByDateAndEmpleado(
      "2025-09-01",
      "2025-09-15",
      "1"
    );
    assertIncap("Q15 3-días-empresa", res.conteoDias, {
      empresa: 3,
      ihss: 0,
      diasLaborados: 12,
    });
  });

  /**
   * Caso 2: Quincena estándar (15 días), 5 días consecutivos
   *
   * Sep 1-3 → empresa (prev Aug 29-31 sin incapacidad)
   * Sep 4   → IHSS (prev Sep 1,2,3 todos incap)
   * Sep 5   → IHSS (prev Sep 2,3,4 todos incap)
   * empresa=[3], IHSS=[2]
   * diasLaborados = 15 - 3 - 2 = 10
   */
  it("Q15: 5 días consecutivos → 3 empresa, 2 IHSS, 10 laborados", async () => {
    const p = new IncapTest();
    seedRange(p, "2025-09-01", 5); // Sep 1-5

    const res = await p.getConteoHorasTrabajajadasByDateAndEmpleado(
      "2025-09-01",
      "2025-09-15",
      "1"
    );
    assertIncap("Q15 5-días", res.conteoDias, {
      empresa: 3,
      ihss: 2,
      diasLaborados: 10,
    });
  });

  /**
   * Caso 3: Quincena estándar (15 días), 7 días consecutivos
   *
   * Sep 1-3 → empresa, Sep 4-7 → IHSS
   * empresa=[3], IHSS=[4]
   * diasLaborados = 15 - 3 - 4 = 8
   */
  it("Q15: 7 días consecutivos → 3 empresa, 4 IHSS, 8 laborados", async () => {
    const p = new IncapTest();
    seedRange(p, "2025-09-01", 7); // Sep 1-7

    const res = await p.getConteoHorasTrabajajadasByDateAndEmpleado(
      "2025-09-01",
      "2025-09-15",
      "1"
    );
    assertIncap("Q15 7-días", res.conteoDias, {
      empresa: 3,
      ihss: 4,
      diasLaborados: 8,
    });
  });

  /**
   * Caso 4: Quincena estándar (15 días), dos intervalos separados
   *
   * Sep 1-3: empresa=[3] (prev sin incap)
   * Sep 8-10: empresa=[3] (prev Sep 5,6,7 sin incap)
   * empresa=[3,3], IHSS=[]
   * LRM([3,3], 15, 15): raws=[3,3], target=6, floors=[3,3], extra=0 → 6
   * diasLaborados = 15 - 6 - 0 = 9
   */
  it("Q15: dos intervalos [3,3] separados → 6 empresa, 0 IHSS, 9 laborados", async () => {
    const p = new IncapTest();
    seedRange(p, "2025-09-01", 3); // Sep 1-3
    seedRange(p, "2025-09-08", 3); // Sep 8-10

    const res = await p.getConteoHorasTrabajajadasByDateAndEmpleado(
      "2025-09-01",
      "2025-09-15",
      "1"
    );
    assertIncap("Q15 dos intervalos empresa", res.conteoDias, {
      empresa: 6,
      ihss: 0,
      diasLaborados: 9,
    });
  });

  /**
   * Caso 5: Quincena estándar (15 días), dos intervalos uno mezcla empresa+IHSS
   *
   * Sep 1-3: empresa=[3]
   * Sep 8-12: Sep 8-10 empresa=[3], Sep 11-12 IHSS=[2]
   * empresa=[3,3], IHSS=[2]
   * LRM empresa([3,3],15,15)=6, LRM IHSS([2],15,15)=2
   * diasLaborados = 15 - 6 - 2 = 7
   */
  it("Q15: dos intervalos [3] y [3+2] → 6 empresa, 2 IHSS, 7 laborados", async () => {
    const p = new IncapTest();
    seedRange(p, "2025-09-01", 3);  // Sep 1-3 empresa
    seedRange(p, "2025-09-08", 5);  // Sep 8-12: 3 empresa + 2 IHSS

    const res = await p.getConteoHorasTrabajajadasByDateAndEmpleado(
      "2025-09-01",
      "2025-09-15",
      "1"
    );
    assertIncap("Q15 dos intervalos mixtos", res.conteoDias, {
      empresa: 6,
      ihss: 2,
      diasLaborados: 7,
    });
  });

  /**
   * Caso 6: Quincena larga (16 días), tres intervalos empresa + IHSS — prueba LRM
   *
   * Oct 2-3:  2 días empresa
   * Oct 7-9:  3 días empresa (prev Oct 4-6 sin incap)
   * Oct 12-14: 3 días empresa (prev Oct 11 sin incap, Oct 9 incap pero no 3 consec previos)
   * Oct 15:   prev Oct 12,13,14 todos incap → IHSS
   *
   * empresa=[2,3,3], IHSS=[1]
   *
   * LRM empresa([2,3,3], 16, 15):
   *   raws=[1.875, 2.8125, 2.8125], sum=7.5, target=round(7.5)=8
   *   floors=[1,2,2]=5, extra=3 → decimals [0.875,0.8125,0.8125] → [2,3,3]=8
   *
   * LRM IHSS([1], 16, 15):
   *   raw=[0.9375], target=1, floor=0, extra=1 → [1]=1
   *
   * diasLaborados = 15 - 8 - 1 = 6
   */
  it("Q16: intervalos [2,3,3] empresa + [1] IHSS → LRM empresa=8, IHSS=1, 6 laborados", async () => {
    const p = new IncapTest();
    seedRange(p, "2025-10-02", 2);  // Oct 2-3   empresa
    seedRange(p, "2025-10-07", 3);  // Oct 7-9   empresa
    seedRange(p, "2025-10-12", 4);  // Oct 12-15: 3 empresa + 1 IHSS

    const res = await p.getConteoHorasTrabajajadasByDateAndEmpleado(
      "2025-10-01",
      "2025-10-16",
      "1"
    );
    assertIncap("Q16 LRM tres intervalos", res.conteoDias, {
      empresa: 8,
      ihss: 1,
      diasLaborados: 6,
    });
  });

  /**
   * Caso 7: Quincena corta (13 días), 4 días consecutivos
   *
   * Nov 3-5 → empresa (prev Oct 31, Nov 1, 2 sin incap)
   * Nov 6   → IHSS (prev Nov 3,4,5 todos incap)
   * empresa=[3], IHSS=[1]
   *
   * LRM empresa([3], 13, 15):
   *   raw=3.4615, target=round(3.4615)=3, floor=3, extra=0 → 3
   *
   * LRM IHSS([1], 13, 15):
   *   raw=1.1538, target=round(1.1538)=1, floor=1, extra=0 → 1
   *
   * diasLaborados = 15 - 3 - 1 = 11
   */
  it("Q13: 4 días consecutivos → LRM empresa=3, IHSS=1, 11 laborados", async () => {
    const p = new IncapTest();
    seedRange(p, "2025-11-03", 4); // Nov 3-6

    const res = await p.getConteoHorasTrabajajadasByDateAndEmpleado(
      "2025-11-01",
      "2025-11-13",
      "1"
    );
    assertIncap("Q13 4-días-consecutivos", res.conteoDias, {
      empresa: 3,
      ihss: 1,
      diasLaborados: 11,
    });
  });

  /**
   * Caso 8: Quincena 16 días, tres intervalos de 1 día — LRM redistribuye decimales
   *
   * Oct 2 incap, Oct 6 incap, Oct 10 incap — todos empresa
   * empresa=[1,1,1], IHSS=[]
   *
   * LRM empresa([1,1,1], 16, 15):
   *   raws=[0.9375,0.9375,0.9375], sum=2.8125, target=round(2.8125)=3
   *   floors=[0,0,0]=0, extra=3 → fracs iguales → [1,1,1]=3
   *
   * diasLaborados = 15 - 3 - 0 = 12
   */
  it("Q16: tres intervalos de 1 día → LRM empresa=3 (todos decimales iguales), 12 laborados", async () => {
    const p = new IncapTest();
    p.seedIncapacidad("2025-10-02"); // 1 día
    p.seedIncapacidad("2025-10-06"); // 1 día
    p.seedIncapacidad("2025-10-10"); // 1 día

    const res = await p.getConteoHorasTrabajajadasByDateAndEmpleado(
      "2025-10-01",
      "2025-10-16",
      "1"
    );
    assertIncap("Q16 tres intervalos 1 día LRM", res.conteoDias, {
      empresa: 3,
      ihss: 0,
      diasLaborados: 12,
    });
  });

  /**
   * Caso 9: Carry-over completo — intervalo inició hace 3+ días en quincena anterior
   *
   * Aug 29-31 incap (quincena anterior, fuera del rango consultado)
   * Sep 1-2 incap (inicio de quincena actual)
   *
   * Sep 1: prev 3 días = Aug 29,30,31 → todos incap → IHSS
   * Sep 2: prev 3 días = Aug 30,31,Sep1 → todos incap → IHSS
   *
   * empresa=[], IHSS=[2]
   * diasLaborados = 15 - 0 - 2 = 13
   */
  it("Carry-over Q15: 3 días previos incap → Sep 1-2 son IHSS, 0 empresa, 13 laborados", async () => {
    const p = new IncapTest();
    seedRange(p, "2025-08-29", 3); // Aug 29-31 (quincena anterior)
    seedRange(p, "2025-09-01", 2); // Sep 1-2

    const res = await p.getConteoHorasTrabajajadasByDateAndEmpleado(
      "2025-09-01",
      "2025-09-15",
      "1"
    );
    assertIncap("Carry-over completo", res.conteoDias, {
      empresa: 0,
      ihss: 2,
      diasLaborados: 13,
    });
  });

  /**
   * Caso 10: Carry-over parcial — solo 1 día incap en quincena anterior
   *
   * Aug 31 incap (solo 1 día previo), Aug 29-30 sin incap
   * Sep 1-4 incap
   *
   * Sep 1: prev = Aug 29(no), Aug 30(no), Aug 31(sí) → NO son 3 → empresa
   * Sep 2: prev = Aug 30(no), Aug 31(sí), Sep 1(sí)  → NO son 3 → empresa
   * Sep 3: prev = Aug 31(sí), Sep 1(sí), Sep 2(sí)   → LOS 3 incap → IHSS
   * Sep 4: prev = Sep 1(sí), Sep 2(sí), Sep 3(sí)    → LOS 3 incap → IHSS
   *
   * empresa=[2], IHSS=[2]
   * diasLaborados = 15 - 2 - 2 = 11
   */
  it("Carry-over Q15: 1 día previo incap → Sep 1-2 empresa, Sep 3-4 IHSS, 11 laborados", async () => {
    const p = new IncapTest();
    p.seedIncapacidad("2025-08-31"); // 1 día previo
    seedRange(p, "2025-09-01", 4);  // Sep 1-4

    const res = await p.getConteoHorasTrabajajadasByDateAndEmpleado(
      "2025-09-01",
      "2025-09-15",
      "1"
    );
    assertIncap("Carry-over parcial 1 día", res.conteoDias, {
      empresa: 2,
      ihss: 2,
      diasLaborados: 11,
    });
  });

  /**
   * Caso 11: Carry-over parcial — 2 días incap en quincena anterior
   *
   * Aug 30-31 incap, Aug 29 sin incap
   * Sep 1-4 incap
   *
   * Sep 1: prev = Aug 29(no), Aug 30(sí), Aug 31(sí) → NO son 3 → empresa
   * Sep 2: prev = Aug 30(sí), Aug 31(sí), Sep 1(sí)  → LOS 3 incap → IHSS
   * Sep 3: prev = Aug 31(sí), Sep 1(sí), Sep 2(sí)   → LOS 3 incap → IHSS
   * Sep 4: prev = Sep 1(sí), Sep 2(sí), Sep 3(sí)    → LOS 3 incap → IHSS
   *
   * empresa=[1], IHSS=[3]
   * diasLaborados = 15 - 1 - 3 = 11
   */
  it("Carry-over Q15: 2 días previos incap → Sep 1 empresa, Sep 2-4 IHSS, 11 laborados", async () => {
    const p = new IncapTest();
    seedRange(p, "2025-08-30", 2); // Aug 30-31
    seedRange(p, "2025-09-01", 4); // Sep 1-4

    const res = await p.getConteoHorasTrabajajadasByDateAndEmpleado(
      "2025-09-01",
      "2025-09-15",
      "1"
    );
    assertIncap("Carry-over parcial 2 días", res.conteoDias, {
      empresa: 1,
      ihss: 3,
      diasLaborados: 11,
    });
  });

  /**
   * Caso 12: Sin incapacidad — quincena limpia (15 días)
   * diasLaborados = 15
   */
  it("Q15: sin incapacidad → 0 empresa, 0 IHSS, 15 laborados", async () => {
    const p = new IncapTest();
    // No se siembra ningún día de incapacidad

    const res = await p.getConteoHorasTrabajajadasByDateAndEmpleado(
      "2025-09-01",
      "2025-09-15",
      "1"
    );
    assertIncap("Q15 sin incapacidad", res.conteoDias, {
      empresa: 0,
      ihss: 0,
      diasLaborados: 15,
    });
  });
});
