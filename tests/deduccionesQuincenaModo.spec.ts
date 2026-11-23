import { describe, it, expect } from "vitest";

/** Espejo de la lógica de cliente (front calcula; backend no aplica). */
type Modo = "SOLO_A" | "SOLO_B" | "AMBAS_MITAD";

function aplica(modo: Modo, esA: boolean): boolean {
  if (modo === "SOLO_A") return esA;
  if (modo === "SOLO_B") return !esA;
  return true;
}

function factor(modo: Modo, esA: boolean): number {
  if (!aplica(modo, esA)) return 0;
  if (modo === "AMBAS_MITAD") return 0.5;
  return 1;
}

describe("modos deducción quincena", () => {
  it("SOLO_B: monto completo en B, 0 en A", () => {
    expect(factor("SOLO_B", true)).toBe(0);
    expect(factor("SOLO_B", false)).toBe(1);
  });

  it("SOLO_A: monto completo en A, 0 en B", () => {
    expect(factor("SOLO_A", true)).toBe(1);
    expect(factor("SOLO_A", false)).toBe(0);
  });

  it("AMBAS_MITAD: mitad en A y en B", () => {
    expect(factor("AMBAS_MITAD", true)).toBe(0.5);
    expect(factor("AMBAS_MITAD", false)).toBe(0.5);
  });
});
