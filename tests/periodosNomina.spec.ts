import { describe, it, expect } from "vitest";
import {
  construirIntervalo,
  construirIntervalosParaAño,
  clasificarPeriodo,
  generarCodigoNomina,
  periodoQueContiene,
  type PeriodosNominaConfig,
} from "../src/domain/nomina/periodosNomina";

const LEGACY: PeriodosNominaConfig = {
  a: { diaInicio: 27, diaFin: 11 },
  b: { diaInicio: 12, diaFin: 26 },
};

const CLASICO: PeriodosNominaConfig = {
  a: { diaInicio: 1, diaFin: 15 },
  b: { diaInicio: 16, diaFin: 0 },
};

describe("periodosNomina — config legacy 27–11 / 12–26", () => {
  it("construye A cruzando mes y B en el mismo mes", () => {
    expect(construirIntervalo(2026, 1, "A", LEGACY)).toEqual({
      fechaInicio: "2025-12-27",
      fechaFin: "2026-01-11",
      letra: "A",
    });
    expect(construirIntervalo(2026, 1, "B", LEGACY)).toEqual({
      fechaInicio: "2026-01-12",
      fechaFin: "2026-01-26",
      letra: "B",
    });
  });

  it("genera códigos YYYYMMP", () => {
    expect(
      generarCodigoNomina("2025-12-27", "2026-01-11", LEGACY),
    ).toBe("202601A");
    expect(
      generarCodigoNomina("2026-01-12", "2026-01-26", LEGACY),
    ).toBe("202601B");
  });

  it("periodoQueContiene ubica fechas en A o B", () => {
    const a = periodoQueContiene(new Date(2026, 0, 5), LEGACY);
    expect(a?.letra).toBe("A");
    expect(a?.fechaInicio).toBe("2025-12-27");
    const b = periodoQueContiene(new Date(2026, 0, 15), LEGACY);
    expect(b?.letra).toBe("B");
  });
});

describe("periodosNomina — config 1–15 / 16–fin de mes", () => {
  it("construye febrero B hasta 28 en no bisiesto", () => {
    expect(construirIntervalo(2025, 2, "A", CLASICO)).toEqual({
      fechaInicio: "2025-02-01",
      fechaFin: "2025-02-15",
      letra: "A",
    });
    expect(construirIntervalo(2025, 2, "B", CLASICO)).toEqual({
      fechaInicio: "2025-02-16",
      fechaFin: "2025-02-28",
      letra: "B",
    });
  });

  it("construye febrero B hasta 29 en bisiesto y abril B hasta 30", () => {
    expect(construirIntervalo(2024, 2, "B", CLASICO).fechaFin).toBe(
      "2024-02-29",
    );
    expect(construirIntervalo(2025, 4, "B", CLASICO).fechaFin).toBe(
      "2025-04-30",
    );
  });

  it("clasifica y genera código", () => {
    expect(clasificarPeriodo("2025-03-01", "2025-03-15", CLASICO)).toBe("A");
    expect(clasificarPeriodo("2025-03-16", "2025-03-31", CLASICO)).toBe("B");
    expect(generarCodigoNomina("2025-03-16", "2025-03-31", CLASICO)).toBe(
      "202503B",
    );
  });

  it("construirIntervalosParaAño incluye A y B", () => {
    const list = construirIntervalosParaAño(
      2024,
      CLASICO,
      new Date(2025, 0, 1),
    );
    const febB = list.find(
      (x) => x.fechaInicio === "2024-02-16" && x.letra === "B",
    );
    expect(febB?.fechaFin).toBe("2024-02-29");
  });
});
