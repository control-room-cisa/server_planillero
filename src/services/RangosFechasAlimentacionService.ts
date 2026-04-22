import { Prisma } from "@prisma/client";
import { RangosFechasAlimentacionRepository } from "../repositories/RangosFechasAlimentacionRepository";
import type { RangoFechasAlimentacionCreateDto } from "../validators/rangosFechasAlimentacion.validator";
import type { RangoFechasAlimentacionUpdateDto } from "../validators/rangosFechasAlimentacion.validator";

function ymdToLocal(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  return new Date(Date.UTC(y, m - 1, d));
}

function toYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysYmd(ymd: string, n: number): string {
  const d = ymdToLocal(ymd);
  d.setDate(d.getDate() + n);
  return toYmd(d);
}

/** Solape inclusivo: [a0,a1] con [b0,b1] (strings YYYY-MM-DD). */
function rangosSeTraslapa(
  a0: string,
  a1: string,
  b0: string,
  b1: string,
): boolean {
  return a0 <= b1 && b0 <= a1;
}

function clientError(
  message: string,
  statusCode = 400,
): Error & { statusCode: number } {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  return err;
}

function maxYmdFechaFinEntreRangos(
  rows: { fechaFin: Date }[],
): string | null {
  if (rows.length === 0) return null;
  let best = toYmd(rows[0]!.fechaFin);
  for (let i = 1; i < rows.length; i++) {
    const y = toYmd(rows[i]!.fechaFin);
    if (y > best) best = y;
  }
  return best;
}

export class RangosFechasAlimentacionService {
  static async listRangosPorCodigoConMeta(codigoNomina: string) {
    const [rows, ultimo] = await Promise.all([
      RangosFechasAlimentacionRepository.listByCodigo(codigoNomina),
      RangosFechasAlimentacionRepository.findConMayorFechaFinDesc(),
    ]);
    return {
      items: rows,
      idPermiteEdicion: ultimo?.id ?? null,
    };
  }

  static async create(dto: RangoFechasAlimentacionCreateDto) {
    const existente = await RangosFechasAlimentacionRepository.findByCodigo(
      dto.codigoNomina,
    );
    if (existente) {
      throw clientError("Ya existe un rango con este código de nómina.");
    }

    const total = await RangosFechasAlimentacionRepository.countAll();
    const todos = await RangosFechasAlimentacionRepository.findManyAll();
    for (const r of todos) {
      if (
        rangosSeTraslapa(
          dto.fechaInicio,
          dto.fechaFin,
          toYmd(r.fechaInicio),
          toYmd(r.fechaFin),
        )
      ) {
        throw clientError("El rango se traslapa con otro registro existente.");
      }
    }

    if (total > 0) {
      const maxFin = await RangosFechasAlimentacionRepository.maxFechaFinGlobal();
      if (maxFin) {
        const ultimaYmd = toYmd(maxFin);
        const esperada = addDaysYmd(ultimaYmd, 1);
        if (dto.fechaInicio !== esperada) {
          throw clientError(
            `La fecha de inicio debe ser ${esperada} (día siguiente a la última fecha de fin registrada: ${ultimaYmd}).`,
          );
        }
      }
    }

    try {
      const row = await RangosFechasAlimentacionRepository.create(dto);
      return RangosFechasAlimentacionRepository.toDto(row);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw clientError("Ya existe un rango con este código de nómina.");
      }
      throw e;
    }
  }

  static async update(id: number, dto: RangoFechasAlimentacionUpdateDto) {
    const row = await RangosFechasAlimentacionRepository.findById(id);
    if (!row) {
      const err: Error & { statusCode?: number } = new Error("Registro no encontrado");
      err.statusCode = 404;
      throw err;
    }

    const ultimo = await RangosFechasAlimentacionRepository.findConMayorFechaFinDesc();
    if (!ultimo || ultimo.id !== id) {
      throw clientError(
        "Solo se puede editar el último rango (el de mayor fecha de fin).",
      );
    }

    const todos = await RangosFechasAlimentacionRepository.findManyAll();
    for (const r of todos) {
      if (r.id === id) continue;
      if (
        rangosSeTraslapa(
          dto.fechaInicio,
          dto.fechaFin,
          toYmd(r.fechaInicio),
          toYmd(r.fechaFin),
        )
      ) {
        throw clientError("El rango se traslapa con otro registro existente.");
      }
    }

    const otros = todos.filter((r) => r.id !== id);
    if (otros.length > 0) {
      const maxYmd = maxYmdFechaFinEntreRangos(otros);
      if (maxYmd) {
        const esperada = addDaysYmd(maxYmd, 1);
        if (dto.fechaInicio !== esperada) {
          throw clientError(
            `La fecha de inicio debe ser ${esperada} (día siguiente a la mayor fecha de fin entre el resto de rangos: ${maxYmd}).`,
          );
        }
      }
    }

    const updated = await RangosFechasAlimentacionRepository.update(id, dto);
    return RangosFechasAlimentacionRepository.toDto(updated);
  }
}
