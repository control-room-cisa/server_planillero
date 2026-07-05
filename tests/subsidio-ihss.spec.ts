import { describe, it, expect } from "vitest";
import {
  calcularSubsidioDiarioIhss,
  diasCalendarioDelMes,
  obtenerTresMesesCalendarioAnteriores,
  roundTo2Decimals,
} from "../src/domain/calculo-horas/politicas-horario/subsidio-ihss";

describe("subsidio-ihss", () => {
  it("obtiene feb, mar y abr para inicio de secuencia en mayo", () => {
    const meses = obtenerTresMesesCalendarioAnteriores("2025-05-12");
    expect(meses.map((m) => m.ymdPrimerDia)).toEqual([
      "2025-02-01",
      "2025-03-01",
      "2025-04-01",
    ]);
  });

  it("suma 89 días calendario feb+mar+abr 2025", () => {
    expect(diasCalendarioDelMes(2025, 2)).toBe(28);
    expect(diasCalendarioDelMes(2025, 3)).toBe(31);
    expect(diasCalendarioDelMes(2025, 4)).toBe(30);
    expect(
      diasCalendarioDelMes(2025, 2) +
        diasCalendarioDelMes(2025, 3) +
        diasCalendarioDelMes(2025, 4)
    ).toBe(89);
  });

  it("calcula subsidio diario con techo 11903.13 en los 3 meses", async () => {
    const result = await calcularSubsidioDiarioIhss("2025-05-12", async () =>
      11903.13
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.totalTecho3Meses).toBeCloseTo(35709.39, 2);
    expect(result.data.totalDias3Meses).toBe(89);
    expect(result.data.salarioBaseDiario).toBeCloseTo(401.229, 3);
    expect(result.data.subsidioDiario).toBe(264.81);
  });

  it("error si falta techo en algún mes", async () => {
    const result = await calcularSubsidioDiarioIhss("2025-05-12", async (f) =>
      f === "2025-03-01" ? null : 11903.13
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("2025-03");
  });

  it("redondea subsidio a 2 decimales antes de multiplicar", () => {
    const salarioBase = 35709.39 / 89;
    const subsidio = roundTo2Decimals(salarioBase * 0.66);
    expect(subsidio).toBe(264.81);
    expect(roundTo2Decimals(2 * subsidio)).toBe(529.62);
  });
});
