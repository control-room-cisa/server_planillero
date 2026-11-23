import { describe, it, expect } from "vitest";
import { resolverSueldoDesdeFilas } from "../src/domain/empleado/sueldoVigente";

describe("resolverSueldoDesdeFilas", () => {
  const filas = [
    { sueldoMensual: 10000, fechaVigencia: "2025-01-01" },
    { sueldoMensual: 12000, fechaVigencia: "2025-06-15" },
    { sueldoMensual: 15000, fechaVigencia: "2026-01-01" },
  ];

  it("usa el sueldo vigente a la fecha de referencia", () => {
    expect(resolverSueldoDesdeFilas(filas, "2025-03-01")).toBe(10000);
    expect(resolverSueldoDesdeFilas(filas, "2025-06-15")).toBe(12000);
    expect(resolverSueldoDesdeFilas(filas, "2025-12-27")).toBe(12000);
    expect(resolverSueldoDesdeFilas(filas, "2026-01-01")).toBe(15000);
    expect(resolverSueldoDesdeFilas(filas, "2026-11-20")).toBe(15000);
  });

  it("devuelve fallback si no hay filas anteriores a la fecha", () => {
    expect(resolverSueldoDesdeFilas(filas, "2024-12-31", 5000)).toBe(5000);
    expect(resolverSueldoDesdeFilas([], "2026-01-01", 0)).toBe(0);
  });

  it("ante misma vigencia, prefiere la última en la lista", () => {
    const dup = [
      { sueldoMensual: 10000, fechaVigencia: "2025-01-01" },
      { sueldoMensual: 11000, fechaVigencia: "2025-01-01" },
    ];
    expect(resolverSueldoDesdeFilas(dup, "2025-01-01")).toBe(11000);
  });
});
