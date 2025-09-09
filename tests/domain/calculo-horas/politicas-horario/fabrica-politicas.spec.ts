import { describe, it, expect, vi } from "vitest";
import { TipoHorario } from "@prisma/client";
import { FabricaPoliticas } from "../../../../src/domain/calculo-horas/politicas-horario/fabrica-politicas";
import { PoliticaH1 } from "../../../../src/domain/calculo-horas/politicas-horario/H1";
import { PoliticaH2 } from "../../../../src/domain/calculo-horas/politicas-horario/H2";

describe("FabricaPoliticas.crearPolitica", () => {
  it("devuelve instancia de PoliticaH1 para H1", () => {
    const politica = FabricaPoliticas.crearPolitica(TipoHorario.H1);
    expect(politica).toBeInstanceOf(PoliticaH1);
  });

  it("devuelve instancia de PoliticaH2 para H2", () => {
    const politica = FabricaPoliticas.crearPolitica(TipoHorario.H2);
    expect(politica).toBeInstanceOf(PoliticaH2);
  });

  it("lanza error para tipos no implementados (H3..H7)", () => {
    const pendientes: TipoHorario[] = [
      TipoHorario.H3,
      TipoHorario.H4,
      TipoHorario.H5,
      TipoHorario.H6,
      TipoHorario.H7,
    ];

    for (const t of pendientes) {
      expect(() => FabricaPoliticas.crearPolitica(t)).toThrowError(
        /no implementada/i
      );
      try {
        FabricaPoliticas.crearPolitica(t);
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        expect(msg).toContain(`${t}`);
      }
    }
  });

  it("lanza error para tipo desconocido (default)", () => {
    expect(() =>
      FabricaPoliticas.crearPolitica("INVALID" as any)
    ).toThrowError(/no reconocido/i);
  });
});

describe("FabricaPoliticas.esTipoSoportado", () => {
  it("retorna true para H1 y H2", () => {
    expect(FabricaPoliticas.esTipoSoportado(TipoHorario.H1)).toBe(true);
    expect(FabricaPoliticas.esTipoSoportado(TipoHorario.H2)).toBe(true);
  });

  it("retorna false para H3 (y superiores)", () => {
    expect(FabricaPoliticas.esTipoSoportado(TipoHorario.H3)).toBe(false);
    expect(FabricaPoliticas.esTipoSoportado(TipoHorario.H4)).toBe(false);
    expect(FabricaPoliticas.esTipoSoportado(TipoHorario.H5)).toBe(false);
    expect(FabricaPoliticas.esTipoSoportado(TipoHorario.H6)).toBe(false);
    expect(FabricaPoliticas.esTipoSoportado(TipoHorario.H7)).toBe(false);
  });
});

describe("FabricaPoliticas.getTiposSoportados", () => {
  it("devuelve [H1, H2] en orden", () => {
    expect(FabricaPoliticas.getTiposSoportados()).toEqual([
      TipoHorario.H1,
      TipoHorario.H2,
    ]);
  });
});

describe("FabricaPoliticas.getTiposPendientes", () => {
  it("devuelve [H3..H7] en orden", () => {
    expect(FabricaPoliticas.getTiposPendientes()).toEqual([
      TipoHorario.H3,
      TipoHorario.H4,
      TipoHorario.H5,
      TipoHorario.H6,
      TipoHorario.H7,
    ]);
  });
});

