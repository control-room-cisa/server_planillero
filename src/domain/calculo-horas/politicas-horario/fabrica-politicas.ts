// src/domain/politicas-horario/fabrica-politicas.ts
import { TipoHorario } from "@prisma/client";
import { IPoliticaHorario } from "../interfaces";
import { PoliticaH1 } from "./H1";
import { PoliticaH2 } from "./H2";

/**
 * Factory para crear instancias de políticas de horario
 */
export class FabricaPoliticas {
  /**
   * Crea una instancia de la política de horario correspondiente
   */
  static crearPolitica(tipoHorario: TipoHorario): IPoliticaHorario {
    switch (tipoHorario) {
      case TipoHorario.H1:
        return new PoliticaH1();

      case TipoHorario.H2:
        return new PoliticaH2();

      case TipoHorario.H3:
      case TipoHorario.H4:
      case TipoHorario.H5:
      case TipoHorario.H6:
      case TipoHorario.H7:
        throw new Error(
          `Política de horario ${tipoHorario} no implementada aún`
        );

      default:
        throw new Error(`Tipo de horario ${tipoHorario} no reconocido`);
    }
  }

  /**
   * Verifica si un tipo de horario está soportado
   */
  static esTipoSoportado(tipoHorario: TipoHorario): boolean {
    const tiposSoportados: TipoHorario[] = [TipoHorario.H1, TipoHorario.H2];
    return tiposSoportados.includes(tipoHorario);
  }

  /**
   * Obtiene la lista de tipos de horario soportados
   */
  static getTiposSoportados(): TipoHorario[] {
    return [TipoHorario.H1, TipoHorario.H2];
  }

  /**
   * Obtiene la lista de tipos de horario pendientes de implementación
   */
  static getTiposPendientes(): TipoHorario[] {
    return [
      TipoHorario.H3,
      TipoHorario.H4,
      TipoHorario.H5,
      TipoHorario.H6,
      TipoHorario.H7,
    ];
  }
}
