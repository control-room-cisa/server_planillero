import type { HorasPorClass, HorasPorJob } from "../types";
import { VehiculoService } from "../../../services/VehiculoService";

export type BandaExtraProrrateo = "p25" | "p50" | "p75" | "p100";

/** Acumulador interno por job (+ desglose por class). */
export type ProrrateoJobAccum = {
  jobId: number;
  codigoJob: string;
  nombreJob: string;
  horas: number;
  /** Comentario con la class a la que pertenece (deduplicado por texto+classKey). */
  comentarios: Array<{ texto: string; classKey: string }>;
  horasPorClass: Map<string, number>;
};

export function classKeyFromActividad(act: {
  className?: number | string | null;
}): string {
  const raw = act?.className;
  if (raw === undefined || raw === null || raw === "") return "null";
  if (typeof raw === "number") return Number.isFinite(raw) ? String(raw) : "null";
  const parsed = Number.parseInt(String(raw).trim(), 10);
  return Number.isNaN(parsed) ? "null" : String(parsed);
}

export function classValueFromKey(key: string): number | null {
  return key === "null" ? null : Number.parseInt(key, 10);
}

export function classKeyFromSegmentClass(className?: number | null): string {
  return className == null ? "null" : String(className);
}

export function createProrrateoJobAccum(
  jobId: number,
  codigo: string,
  nombre: string
): ProrrateoJobAccum {
  return {
    jobId,
    codigoJob: codigo,
    nombreJob: nombre,
    horas: 0,
    comentarios: [],
    horasPorClass: new Map(),
  };
}

export function addHorasPorClass(
  accum: ProrrateoJobAccum,
  classKey: string,
  horas: number
): void {
  if (horas <= 0) return;
  accum.horas += horas;
  accum.horasPorClass.set(
    classKey,
    (accum.horasPorClass.get(classKey) ?? 0) + horas
  );
}

export function findAccumByCodigo(
  map: Map<number, ProrrateoJobAccum>,
  codigo: string
): ProrrateoJobAccum | undefined {
  for (const v of map.values()) {
    if (v.codigoJob === codigo) return v;
  }
  return undefined;
}

export function jobMapKey(baseKey: number, codigo: string): number {
  return `${baseKey}:${codigo}` as unknown as number;
}

export function upsertProrrateoJob(
  map: Map<number, ProrrateoJobAccum>,
  key: number,
  jobId: number,
  codigo: string,
  nombre: string,
  classKey: string,
  horas: number,
  descripcion?: string | null
): void {
  if (horas <= 0) return;
  let entry = map.get(key);
  if (!entry) {
    entry = createProrrateoJobAccum(jobId, codigo, nombre);
    map.set(key, entry);
  }
  addHorasPorClass(entry, classKey, horas);
  if (descripcion) {
    const yaExiste = entry.comentarios.some(
      (c) => c.texto === descripcion && c.classKey === classKey
    );
    if (!yaExiste) {
      entry.comentarios.push({ texto: descripcion, classKey });
    }
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buildHorasPorClassArray(
  accum: ProrrateoJobAccum,
  resolveNombre: (classValue: number | null) => string | null
): HorasPorClass[] {
  const items: HorasPorClass[] = [];
  for (const [key, rawHoras] of accum.horasPorClass) {
    const classValue = classValueFromKey(key);
    items.push({
      class: classValue,
      nombreClass: resolveNombre(classValue),
      cantidadHoras: round2(rawHoras),
    });
  }

  const sumClasses = round2(
    items.reduce((a, x) => a + x.cantidadHoras, 0)
  );
  const total = round2(accum.horas);
  const diff = round2(total - sumClasses);
  if (items.length > 0 && Math.abs(diff) >= 0.01) {
    items[0].cantidadHoras = round2(items[0].cantidadHoras + diff);
  }

  return items.sort((a, b) => {
    const ca = a.class ?? -1;
    const cb = b.class ?? -1;
    return ca - cb;
  });
}

export function prorrateoMapToHorasPorJob(
  map: Map<number, ProrrateoJobAccum>,
  resolveNombre: (classValue: number | null) => string | null
): HorasPorJob[] {
  return Array.from(map.values())
    .map((item) => ({
      jobId: item.jobId,
      codigoJob: item.codigoJob,
      nombreJob: item.nombreJob,
      cantidadHoras: round2(item.horas),
      comentarios: item.comentarios.map((c) => {
        const classValue = classValueFromKey(c.classKey);
        return {
          texto: c.texto,
          class: classValue,
          nombreClass: resolveNombre(classValue),
        };
      }),
      horasPorClass: buildHorasPorClassArray(item, resolveNombre),
    }))
    .filter((item) => item.cantidadHoras > 0);
}

export async function createClassNameResolver(): Promise<
  (classValue: number | null) => string | null
> {
  const vehiculos = await VehiculoService.listVehiculos();
  const byClass = new Map<number, string>();
  for (const v of vehiculos) {
    byClass.set(v.class, v.nombre);
  }
  return (classValue: number | null) =>
    classValue == null ? null : byClass.get(classValue) ?? null;
}
