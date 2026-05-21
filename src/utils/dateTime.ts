/**
 * Fechas calendario YYYY-MM-DD (sin desfase por zona horaria).
 * Misma convención que client_planillero/src/utils/dateTime.ts y PoliticaH1Base.addDays.
 */

export const ISO_YMD = /^\d{4}-\d{2}-\d{2}$/;

/** `fecha` como "YYYY-MM-DD" o ISO; toma los 10 primeros caracteres si son válidos. */
export function registroFechaToYmdSafe(
  fecha: string | undefined | null,
): string | null {
  if (!fecha) return null;
  const s = fecha.trim().slice(0, 10);
  return ISO_YMD.test(s) ? s : null;
}

export function isValidYmd(value: string): boolean {
  return ISO_YMD.test(value.trim());
}

/** Compara dos YYYY-MM-DD (orden lexicográfico = orden calendario). */
export function compareYmd(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function ymdGt(a: string, b: string): boolean {
  return a > b;
}

/** Suma días calendario (UTC). Usado por políticas H1/H2 y rangos de alimentación. */
export function addDaysYmd(ymd: string, days: number): string {
  const [Y, M, D] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(Y, M - 1, D));
  dt.setUTCDate(dt.getUTCDate() + days);
  const y = dt.getUTCFullYear();
  const m = `${dt.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${dt.getUTCDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Convierte YYYY-MM-DD a Date medianoche UTC (columnas Prisma @db.Date). */
export function ymdToPrismaDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  return new Date(Date.UTC(y, m - 1, d));
}

/** Lee un Date de columna DATE con componentes UTC (evita -1 día en UTC-). */
export function prismaDateToYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
