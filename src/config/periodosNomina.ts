import {
  assertPeriodosNominaConfig,
  DEFAULT_PERIODOS_NOMINA_CONFIG,
  type PeriodosNominaConfig,
} from "../domain/nomina/periodosNomina";

function parseDiaEnv(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new Error(`Día de quincena inválido en .env: "${raw}"`);
  }
  return n;
}

let cached: PeriodosNominaConfig | null = null;

/**
 * Lee cortes A/B desde process.env (con defaults 27–11 / 12–26).
 * Día fin = 0 ⇒ último día del mes.
 */
export function getPeriodosNominaConfig(): PeriodosNominaConfig {
  if (cached) return cached;

  const config: PeriodosNominaConfig = {
    a: {
      diaInicio: parseDiaEnv(
        process.env.NOMINA_QUINCENA_A_DIA_INICIO,
        DEFAULT_PERIODOS_NOMINA_CONFIG.a.diaInicio,
      ),
      diaFin: parseDiaEnv(
        process.env.NOMINA_QUINCENA_A_DIA_FIN,
        DEFAULT_PERIODOS_NOMINA_CONFIG.a.diaFin,
      ),
    },
    b: {
      diaInicio: parseDiaEnv(
        process.env.NOMINA_QUINCENA_B_DIA_INICIO,
        DEFAULT_PERIODOS_NOMINA_CONFIG.b.diaInicio,
      ),
      diaFin: parseDiaEnv(
        process.env.NOMINA_QUINCENA_B_DIA_FIN,
        DEFAULT_PERIODOS_NOMINA_CONFIG.b.diaFin,
      ),
    },
  };

  assertPeriodosNominaConfig(config);
  cached = config;
  return cached;
}

/** Solo para tests. */
export function resetPeriodosNominaConfigCache(): void {
  cached = null;
}

/** Solo para tests: fija config sin leer env. */
export function setPeriodosNominaConfigForTests(
  config: PeriodosNominaConfig | null,
): void {
  if (config) assertPeriodosNominaConfig(config);
  cached = config;
}
