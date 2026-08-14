import { describe, it, expect } from "vitest";
import {
  horasE02Contables,
  reinterpretE02VacacionesMin,
} from "../src/domain/calculo-horas/politicas-horario/e02Vacaciones";

function utc(fecha: string, hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(`${fecha}T00:00:00.000Z`);
  d.setUTCHours(h, m ?? 0, 0, 0);
  return d;
}

describe("reinterpretE02VacacionesMin", () => {
  it("día 9h completo (9h) → 8h", () => {
    expect(reinterpretE02VacacionesMin(9 * 60, 9 * 60)).toBe(8 * 60);
  });

  it("día 9h medio (4.5h) → 4h", () => {
    expect(reinterpretE02VacacionesMin(4.5 * 60, 9 * 60)).toBe(4 * 60);
  });

  it("día 12h completo (12h) → 8h", () => {
    expect(reinterpretE02VacacionesMin(12 * 60, 12 * 60)).toBe(8 * 60);
  });

  it("día 12h medio (6h) → 4h", () => {
    expect(reinterpretE02VacacionesMin(6 * 60, 12 * 60)).toBe(4 * 60);
  });

  it("día 8h completo/medio coinciden con 8h/4h", () => {
    expect(reinterpretE02VacacionesMin(8 * 60, 8 * 60)).toBe(8 * 60);
    expect(reinterpretE02VacacionesMin(4 * 60, 8 * 60)).toBe(4 * 60);
  });

  it("registro viejo 6h en día 9h se deja tal cual", () => {
    expect(reinterpretE02VacacionesMin(6 * 60, 9 * 60)).toBe(6 * 60);
  });
});

describe("horasE02Contables con registro 07–17 (UTC-6)", () => {
  const fecha = "2026-02-02";
  const registro = {
    horaEntrada: utc(fecha, "13:00"),
    horaSalida: utc(fecha, "23:00"),
  };

  it("9h E02 con 1h almuerzo → 8h", () => {
    expect(horasE02Contables(9, registro, 60)).toBe(8);
  });

  it("4.5h E02 con 1h almuerzo → 4h", () => {
    expect(horasE02Contables(4.5, registro, 60)).toBe(4);
  });
});
