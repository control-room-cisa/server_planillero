// src/domain/calculo-horas/politicas-horario/H2.ts
import { PoliticaH2Base } from "./H2Base";

/**
 * Clase base abstracta para políticas H2
 * No debe instanciarse directamente, solo a través de sus subtipos (H2_1, H2_2, etc.)
 *
 * Esta clase hereda toda la lógica de cálculo de horas de H2Base
 * y requiere que los subtipos implementen cómo se genera el horario de trabajo.
 */
export abstract class PoliticaH2 extends PoliticaH2Base {
  // Esta clase es abstracta y no puede ser instanciada directamente
  // Los subtipos deben implementar getHorarioTrabajoByDateAndEmpleado
}
