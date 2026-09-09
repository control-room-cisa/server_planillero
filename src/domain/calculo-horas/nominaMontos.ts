/** Base de días de una quincena (igual que CalculoNominasDashboard / ProrrateoDashboard). */
export const PERIODO_NOMINA = 15;

export function roundNomina2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Monto proporcional al salario quincenal por N días del período. */
export function montoPorDiasQuincena(
  salarioQuincenal: number,
  dias: number,
  periodoNomina: number = PERIODO_NOMINA
): number {
  return roundNomina2(
    (salarioQuincenal * dias) / (periodoNomina > 0 ? periodoNomina : PERIODO_NOMINA)
  );
}

/**
 * Monto de una fila de prorrateo: reparte totalMonto entre horasProrrateables.
 * Jobs especiales (E01–E05) no deben llegar aquí; se tratan fuera del prorrateo.
 */
export function calcMontoFilaProrrateo(
  _codigoJob: string | null | undefined,
  horas: number,
  totalMonto: number,
  horasProrrateables: number,
  _salarioQuincenal: number
): number {
  if (totalMonto <= 0 || horasProrrateables <= 0) return 0;
  return (horas / horasProrrateables) * totalMonto;
}

export function montosNominaDesdeDias(
  sueldoMensual: number,
  diasVacaciones: number,
  diasLaborados: number
): {
  salarioQuincenal: number;
  montoVacaciones: number;
  montoDiasLaborados: number;
} {
  const salarioQuincenal = sueldoMensual / 2;
  return {
    salarioQuincenal,
    montoVacaciones: montoPorDiasQuincena(
      salarioQuincenal,
      diasVacaciones,
      PERIODO_NOMINA
    ),
    montoDiasLaborados: montoPorDiasQuincena(
      salarioQuincenal,
      diasLaborados,
      PERIODO_NOMINA
    ),
  };
}
