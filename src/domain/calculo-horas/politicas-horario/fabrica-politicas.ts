// src/domain/calculo-horas/politicas-horario/fabrica-politicas.ts
import { TipoHorario } from "@prisma/client";
import { IPoliticaHorario } from "../interfaces";
import { PoliticaH1 } from "./H1";
import { PoliticaH1_1 } from "./H1_1";
import { PoliticaH1_2 } from "./H1_2";
import { PoliticaH1_3 } from "./H1_3";
import { PoliticaH1_4 } from "./H1_4";
import { PoliticaH1_5 } from "./H1_5";
import { PoliticaH1_6 } from "./H1_6";
import { PoliticaH1_7 } from "./H1_7";
import { PoliticaH2_1 } from "./H2_1";
import { PoliticaH2_2 } from "./H2_2";

/**
 * Factory para crear instancias de políticas de horario
 */
export class FabricaPoliticas {
  /**
   * Crea una instancia de la política de horario correspondiente
   */
  static crearPolitica(tipoHorario: TipoHorario): IPoliticaHorario {
    switch (tipoHorario) {
      case TipoHorario.H1_1:
        return new PoliticaH1_1();

      case TipoHorario.H1_2:
        return new PoliticaH1_2();

      case TipoHorario.H1_3:
        return new PoliticaH1_3();

      case TipoHorario.H1_4:
        return new PoliticaH1_4();

      case TipoHorario.H1_5:
        return new PoliticaH1_5();

      case TipoHorario.H1_6:
        return new PoliticaH1_6();

      case TipoHorario.H1_7:
        return new PoliticaH1_7();

      case TipoHorario.H2_1:
        return new PoliticaH2_1();

      case TipoHorario.H2_2:
        return new PoliticaH2_2();

      default:
        throw new Error(`Tipo de horario ${tipoHorario} no reconocido`);
    }
  }

  /**
   * Verifica si un tipo de horario está soportado
   */
  static esTipoSoportado(tipoHorario: TipoHorario): boolean {
    const tiposSoportados: TipoHorario[] = [
      TipoHorario.H1_1,
      TipoHorario.H1_2,
      TipoHorario.H1_3,
      TipoHorario.H1_4,
      TipoHorario.H1_5,
      TipoHorario.H1_6,
      TipoHorario.H1_7,
      TipoHorario.H2_1,
      TipoHorario.H2_2,
    ];
    return tiposSoportados.includes(tipoHorario);
  }

  /**
   * Obtiene la lista de tipos de horario soportados
   */
  static getTiposSoportados(): TipoHorario[] {
    return [
      TipoHorario.H1_1,
      TipoHorario.H1_2,
      TipoHorario.H1_3,
      TipoHorario.H1_4,
      TipoHorario.H1_5,
      TipoHorario.H1_6,
      TipoHorario.H1_7,
      TipoHorario.H2_1,
      TipoHorario.H2_2,
    ];
  }

  /**
   * Obtiene la lista de tipos de horario pendientes de implementación
   */
  static getTiposPendientes(): TipoHorario[] {
    return [];
  }
}
