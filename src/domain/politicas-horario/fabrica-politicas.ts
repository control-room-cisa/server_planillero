// ============================================================================
// dominio/fabrica-politicas.ts
// ============================================================================
import { EmpleadoRef, TipoHorario } from "./types";
import { IPoliticaHorario } from "./interfaces";
import { PoliticaH1 } from "./H1";
import { PoliticaH2 } from "./H2";

export class FabricaPoliticas {
  static paraEmpleado(emp: EmpleadoRef): IPoliticaHorario {
    switch (emp.tipoHorario) {
      case TipoHorario.H1:
        return new PoliticaH1();
      case TipoHorario.H2:
        return new PoliticaH2();
      default:
        return new PoliticaH1();
    }
  }
}
