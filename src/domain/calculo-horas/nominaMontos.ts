/** Base de días de una quincena (igual que CalculoNominasDashboard / ProrrateoDashboard). */
export const PERIODO_NOMINA = 15;

export function roundNomina2(n: number): number {
  return Math.round(n * 100) / 100;
}

function isE02(codigo?: string | null): boolean {
  return (codigo ?? "").trim().toUpperCase() === "E02";
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
 * Monto de una fila de prorrateo:
 * - E02: proporcional a horas/8 sobre la quincena
 * - resto: reparte totalMonto entre horasProrrateables
 */
export function calcMontoFilaProrrateo(
  codigoJob: string | null | undefined,
  horas: number,
  totalMonto: number,
  horasProrrateables: number,
  salarioQuincenal: number
): number {
  if (isE02(codigoJob)) {
    return montoPorDiasQuincena(salarioQuincenal, horas / 8, PERIODO_NOMINA);
  }
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
