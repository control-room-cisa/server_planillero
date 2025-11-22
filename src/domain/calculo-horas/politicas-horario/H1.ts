// src/domain/calculo-horas/politicas-horario/H1.ts
import { PoliticaH1Base } from "./H1Base";

/**
 * Clase base abstracta para políticas H1
 * No debe instanciarse directamente, solo a través de sus subtipos (H1_1, H1_2, H1_3)
 * 
 * Esta clase hereda toda la lógica de cálculo de horas de H1Base
 * y requiere que los subtipos implementen cómo se genera el horario de trabajo.
 */
export abstract class PoliticaH1 extends PoliticaH1Base {
  // Esta clase es abstracta y no puede ser instanciada directamente
  // Los subtipos deben implementar getHorarioTrabajoByDateAndEmpleado
}
