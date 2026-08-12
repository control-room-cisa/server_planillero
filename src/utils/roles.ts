import { Roles } from "../enums/roles";

/** Roles distintos de EMPLEADO (capacidad elevada). */
export const PRIVILEGED_ROLES: Roles[] = [
  Roles.SUPERVISOR,
  Roles.RRHH,
  Roles.SUPERVISOR_CONTABILIDAD,
  Roles.GERENCIA,
  Roles.SISTEMAS,
  Roles.ASISTENTE_CONTABILIDAD,
  Roles.LOGISTICA,
];

export function normalizeRolIdsList(rolIds: number[]): number[] {
  const set = new Set(
    (rolIds || []).map(Number).filter((id) => Number.isFinite(id) && id > 0)
  );
  return Array.from(set).sort((a, b) => a - b);
}

/** @deprecated Usar normalizeRolIdsList. Ya no fuerza EMPLEADO. */
export function ensureEmpleadoRole(rolIds: number[]): number[] {
  return normalizeRolIdsList(rolIds);
}

export function hasAnyRole(
  rolIds: number[] | undefined | null,
  ...roles: Roles[]
): boolean {
  if (!rolIds?.length || !roles.length) return false;
  return roles.some((r) => rolIds.includes(r));
}

/** True si el usuario no tiene ningún rol privilegiado (solo EMPLEADO o vacío). */
export function hasOnlyEmpleado(rolIds: number[] | undefined | null): boolean {
  if (!rolIds?.length) return true;
  return !rolIds.some((r) => PRIVILEGED_ROLES.includes(r as Roles));
}

export function rolIdsFromRelations(
  roles: Array<{ rolId: number }> | undefined | null
): number[] {
  if (!roles?.length) return [];
  return roles.map((r) => r.rolId);
}
