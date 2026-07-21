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
    // Piso 1: salario base diario a 2 decimales
    expect(result.data.salarioBaseDiario).toBe(401.22);
    // Piso 2: subsidio = salarioBase × 0.66 a 2 decimales
    expect(result.data.subsidioDiario).toBe(264.8);
  });

  it("error si falta techo en algún mes", async () => {
    const result = await calcularSubsidioDiarioIhss("2025-05-12", async (f) =>
      f === "2025-03-01" ? null : 11903.13
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("2025-03");
  });

  it("aplica piso a 2 decimales en salario base y subsidio (×0.66)", () => {
    const salarioBase = roundTo2Decimals(35709.39 / 89);
    expect(salarioBase).toBe(401.22);
    const subsidio = roundTo2Decimals(salarioBase * 0.66);
    expect(subsidio).toBe(264.8);
    expect(roundTo2Decimals(2 * subsidio)).toBe(529.6);

    // Caso 92 días (abr+may+jun): alinea con Excel TRUNC/ROUNDDOWN
    const salario92 = roundTo2Decimals(35709.39 / 92);
    expect(salario92).toBe(388.14);
    expect(roundTo2Decimals(salario92 * 0.66)).toBe(256.17);
  });
});
