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

/**
 * Separa montoDiasLaborados entre horas de jobs normales y permiso justificado
 * con la misma tarifa horaria. El permiso no se prorratea por job; solo se informa.
 */
export function repartirMontoDiasLaboradosConPermisoJustificado(
  montoDiasLaborados: number,
  horasJobsNormales: number,
  horasPermisoJustificado: number
): {
  precioHora: number;
  montoJobsNormales: number;
  montoPermisoJustificado: number;
} {
  const monto = Number(montoDiasLaborados) || 0;
  const hJobs = Math.max(0, Number(horasJobsNormales) || 0);
  const hPermiso = Math.max(0, Number(horasPermisoJustificado) || 0);
  const hTotal = hJobs + hPermiso;

  if (monto <= 0 || hTotal <= 0) {
    return {
      precioHora: 0,
      montoJobsNormales: 0,
      montoPermisoJustificado: 0,
    };
  }

  const precioHora = monto / hTotal;
  const montoPermisoJustificado = roundNomina2(hPermiso * precioHora);
  const montoJobsNormales = roundNomina2(monto - montoPermisoJustificado);

  return {
    precioHora,
    montoJobsNormales,
    montoPermisoJustificado,
  };
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
