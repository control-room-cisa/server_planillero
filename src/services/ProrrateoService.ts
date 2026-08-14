// src/services/ProrrateoService.ts
import type { TipoProrrateo } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../errors/AppError";
import { HorarioTrabajoDomain } from "../domain/calculo-horas/horario-trabajo-domain";
import type { HorasPorJob } from "../domain/calculo-horas/types";
import { NominaRepository } from "../repositories/NominaRepository";
import {
  ProrrateoRepository,
  type ProrrateoCreateRow,
} from "../repositories/ProrrateoRepository";
import { BancoCompensatoriasRepository } from "../repositories/BancoCompensatoriasRepository";
import { AccesoContabilidadService } from "./AccesoContabilidadService";
import type { AsignacionCompensatoriaTomadaDto } from "../validators/prorrateo.validator";
import {
  roundNomina2,
  calcMontoFilaProrrateo,
} from "../domain/calculo-horas/nominaMontos";

const round2 = roundNomina2;

function toFechaStr(fecha: Date | string): string {
  if (fecha instanceof Date) return fecha.toISOString().split("T")[0];
  const s = String(fecha);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function isE02(codigo?: string | null): boolean {
  return (codigo ?? "").trim().toUpperCase() === "E02";
}

function normalizeJobId(jobId: number | null | undefined): number | null {
  if (jobId == null || !Number.isFinite(jobId) || jobId <= 0) return null;
  return Number(jobId);
}

/**
 * Expande jobs a filas por class (codigo denormalizado).
 * Si no hay desglose por class, una fila con codigoClass null.
 */
function expandJobsToRows(
  jobs: HorasPorJob[],
  tipo: TipoProrrateo,
  nominaId: number,
  totalMontoBanda: number,
  salarioQuincenal: number,
  montoPorHora: number | null,
  validJobIds: Set<number>
): ProrrateoCreateRow[] {
  const rows: ProrrateoCreateRow[] = [];
  const totalHoras = (jobs ?? []).reduce(
    (acc, j) => acc + Number(j.cantidadHoras ?? 0),
    0
  );
  const horasE02Total = (jobs ?? []).reduce(
    (acc, j) =>
      acc + (isE02(j.codigoJob) ? Number(j.cantidadHoras ?? 0) : 0),
    0
  );
  const horasProrrateables = Math.max(0, totalHoras - horasE02Total);

  const resolveMonto = (codigoJob: string | null | undefined, horas: number) => {
    if (montoPorHora != null) {
      return round2(horas * montoPorHora);
    }
    return round2(
      calcMontoFilaProrrateo(
        codigoJob,
        horas,
        totalMontoBanda,
        horasProrrateables,
        salarioQuincenal
      )
    );
  };

  for (const j of jobs ?? []) {
    const horasJob = Number(j.cantidadHoras ?? 0);
    if (horasJob <= 0) continue;

    const rawJobId = normalizeJobId(j.jobId);
    const jobId =
      rawJobId != null && validJobIds.has(rawJobId) ? rawJobId : null;
    const codigoJob = (j.codigoJob ?? "").trim() || null;

    const classRows = (j.horasPorClass ?? []).filter((c) => c.class != null);
    if (classRows.length > 0) {
      let horasAsignadas = 0;
      for (const c of classRows) {
        const horasClass = Number(c.cantidadHoras ?? 0);
        if (horasClass <= 0) continue;
        horasAsignadas += horasClass;
        rows.push({
          nominaId,
          jobId,
          codigoJob,
          codigoClass: String(c.class),
          cantidadHoras: round2(horasClass),
          monto: resolveMonto(codigoJob, horasClass),
          tipo,
        });
      }
      const horasSinClass = round2(horasJob - horasAsignadas);
      if (horasSinClass > 0.001) {
        rows.push({
          nominaId,
          jobId,
          codigoJob,
          codigoClass: null,
          cantidadHoras: horasSinClass,
          monto: resolveMonto(codigoJob, horasSinClass),
          tipo,
        });
      }
    } else {
      rows.push({
        nominaId,
        jobId,
        codigoJob,
        codigoClass: null,
        cantidadHoras: round2(horasJob),
        monto: resolveMonto(codigoJob, horasJob),
        tipo,
      });
    }
  }

  return rows;
}

export class ProrrateoService {
  static async existePorNomina(
    nominaId: number,
    viewerEmpleadoId: number,
    viewerRolIds: number[]
  ): Promise<{
    guardado: boolean;
    cantidadFilas: number;
  }> {
    const nomina = await NominaRepository.findById(nominaId);
    if (!nomina || nomina.deletedAt) {
      throw new AppError("Nómina no encontrada", 404);
    }

    await AccesoContabilidadService.assertViewerCanAccessProrrateoEmpleado(
      viewerEmpleadoId,
      viewerRolIds,
      nomina.empleadoId
    );

    const cantidadFilas = await ProrrateoRepository.countByNominaId(nominaId);
    return { guardado: cantidadFilas > 0, cantidadFilas };
  }

  /**
   * Calcula el prorrateo en vivo y lo persiste como snapshot cerrado.
   * Requisitos: nómina pagada, cálculo válido, aún no guardado.
   * Si hay compensatorias tomadas, requiere asignaciones a jobs del banco;
   * al guardar rebaja el banco y persiste filas tipo compensatoriaTomada.
   */
  static async guardarDesdeNomina(
    nominaId: number,
    viewerEmpleadoId: number,
    viewerRolIds: number[],
    asignacionesCompensatoriasTomadas: AsignacionCompensatoriaTomadaDto[] = []
  ): Promise<{ cantidadFilas: number; nominaId: number }> {
    const nomina = await NominaRepository.findById(nominaId);
    if (!nomina || nomina.deletedAt) {
      throw new AppError("Nómina no encontrada", 404);
    }

    await AccesoContabilidadService.assertViewerCanAccessProrrateoEmpleado(
      viewerEmpleadoId,
      viewerRolIds,
      nomina.empleadoId
    );

    if (!nomina.pagado) {
      throw new AppError(
        "Solo se puede guardar el prorrateo de una nómina pagada",
        400
      );
    }

    const existentes = await ProrrateoRepository.countByNominaId(nominaId);
    if (existentes > 0) {
      throw new AppError(
        "El prorrateo de esta nómina ya fue guardado y está cerrado",
        409
      );
    }

    const fechaInicio = toFechaStr(nomina.fechaInicio);
    const fechaFin = toFechaStr(nomina.fechaFin);

    let conteo;
    try {
      conteo =
        await HorarioTrabajoDomain.getProrrateoHorasPorJobByDateAndEmpleado(
          fechaInicio,
          fechaFin,
          String(nomina.empleadoId)
        );
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError(
        err?.message ?? "No se pudo calcular el prorrateo",
        err?.statusCode ?? 422,
        err?.validationErrors as
          | {
              fechasNoAprobadas?: string[];
              fechasSinRegistro?: string[];
              [key: string]: string[] | undefined;
            }
          | undefined
      );
    }

    if (conteo.validationErrors) {
      throw new AppError(
        "No se puede guardar el prorrateo: hay validaciones pendientes",
        422,
        conteo.validationErrors as {
          fechasNoAprobadas?: string[];
          fechasSinRegistro?: string[];
          [key: string]: string[] | undefined;
        }
      );
    }

    const sueldoMensual = Number(nomina.sueldoMensual ?? 0);
    const salarioQuincenal = sueldoMensual / 2;
    const salarioPorHora = sueldoMensual / (30 * 8);

    const ch = conteo.cantidadHoras;
    const horasTomadas = round2(Number(ch.horasCompensatoriasTomadas ?? 0));

    const asignacionesValidas = (asignacionesCompensatoriasTomadas ?? []).filter(
      (a) => Number(a.horas) > 0
    );

    // Validar / preparar filas de compensatorias tomadas desde asignaciones del usuario
    let filasCompTomadas: ProrrateoCreateRow[] = [];
    let deltasBanco: { jobId: number | null; horas: number }[] = [];

    if (horasTomadas > 0.001) {
      const totalAsignado = round2(
        asignacionesValidas.reduce((acc, a) => acc + Number(a.horas || 0), 0)
      );
      if (Math.abs(totalAsignado - horasTomadas) > 0.01) {
        throw new AppError(
          `Las asignaciones de compensatorias tomadas (${totalAsignado} h) deben cubrir exactamente ${horasTomadas} h`,
          400
        );
      }

      const seen = new Set<string>();
      for (const a of asignacionesValidas) {
        const key = `${a.jobId ?? "null"}`;
        if (seen.has(key)) {
          throw new AppError(
            "No se puede asignar el mismo job más de una vez en compensatorias tomadas",
            400
          );
        }
        seen.add(key);
      }

      const banco = await BancoCompensatoriasRepository.findByEmpleado(
        nomina.empleadoId
      );
      const bancoByJob = new Map<string, (typeof banco)[number]>(
        banco.map((b) => [`${b.jobId ?? "null"}`, b])
      );

      for (const a of asignacionesValidas) {
        const key = `${a.jobId ?? "null"}`;
        const bankRow = bancoByJob.get(key);
        const disponible = round2(Number(bankRow?.horasAcumuladas ?? 0));
        const horas = round2(Number(a.horas));
        if (!bankRow || horas > disponible + 0.001) {
          const label =
            bankRow?.job?.codigo ||
            (a.jobId != null ? `job #${a.jobId}` : "job no definido");
          throw new AppError(
            `Horas insuficientes en banco para ${label}: disponible ${disponible} h, solicitado ${horas} h`,
            400
          );
        }

        const rawJobId = normalizeJobId(a.jobId);
        filasCompTomadas.push({
          nominaId,
          jobId: rawJobId,
          codigoJob: bankRow.job?.codigo ?? null,
          codigoClass: null,
          cantidadHoras: horas,
          monto: round2(horas * salarioPorHora),
          tipo: "compensatoriaTomada",
        });
        deltasBanco.push({ jobId: a.jobId ?? null, horas: -horas });
      }
    } else if (asignacionesValidas.length > 0) {
      throw new AppError(
        "No hay horas compensatorias tomadas para asignar en este período",
        400
      );
    }

    const jobIds = new Set<number>();
    const collectJobIds = (jobs: HorasPorJob[] | undefined) => {
      for (const j of jobs ?? []) {
        const id = normalizeJobId(j.jobId);
        if (id != null) jobIds.add(id);
      }
    };
    collectJobIds(ch.normal);
    collectJobIds(ch.p25);
    collectJobIds(ch.p50);
    collectJobIds(ch.p75);
    collectJobIds(ch.p100);
    collectJobIds(ch.horasCompensatoriasAcumuladasPorJob);
    for (const f of filasCompTomadas) {
      if (f.jobId != null) jobIds.add(f.jobId);
    }

    const existingJobs =
      jobIds.size > 0
        ? await prisma.job.findMany({
            where: { id: { in: [...jobIds] } },
            select: { id: true },
          })
        : [];
    const validJobIds = new Set(existingJobs.map((j) => j.id));

    // Asegurar FK válida en filas de compensatorias tomadas
    filasCompTomadas = filasCompTomadas.map((f) => ({
      ...f,
      jobId: f.jobId != null && validJobIds.has(f.jobId) ? f.jobId : null,
    }));

    const rows: ProrrateoCreateRow[] = [
      ...expandJobsToRows(
        ch.normal ?? [],
        "normal",
        nominaId,
        Number(nomina.montoDiasLaborados ?? 0),
        salarioQuincenal,
        null,
        validJobIds
      ),
      ...expandJobsToRows(
        ch.p25 ?? [],
        "extra25",
        nominaId,
        Number(nomina.montoHoras25 ?? 0),
        salarioQuincenal,
        null,
        validJobIds
      ),
      ...expandJobsToRows(
        ch.p50 ?? [],
        "extra50",
        nominaId,
        Number(nomina.montoHoras50 ?? 0),
        salarioQuincenal,
        null,
        validJobIds
      ),
      ...expandJobsToRows(
        ch.p75 ?? [],
        "extra75",
        nominaId,
        Number(nomina.montoHoras75 ?? 0),
        salarioQuincenal,
        null,
        validJobIds
      ),
      ...expandJobsToRows(
        ch.p100 ?? [],
        "extra100",
        nominaId,
        Number(nomina.montoHoras100 ?? 0),
        salarioQuincenal,
        null,
        validJobIds
      ),
      ...filasCompTomadas,
      ...expandJobsToRows(
        ch.horasCompensatoriasAcumuladasPorJob ?? [],
        "compensatoriaAcumulada",
        nominaId,
        0,
        salarioQuincenal,
        salarioPorHora,
        validJobIds
      ),
    ];

    if (rows.length === 0) {
      throw new AppError(
        "No hay filas de prorrateo para guardar en este período",
        400
      );
    }

    const cantidadFilas = await prisma.$transaction(async (tx) => {
      const count = await ProrrateoRepository.countByNominaId(nominaId, tx);
      if (count > 0) {
        throw new AppError(
          "El prorrateo de esta nómina ya fue guardado y está cerrado",
          409
        );
      }

      const created = await ProrrateoRepository.createMany(rows, tx);

      if (deltasBanco.length > 0) {
        await BancoCompensatoriasRepository.aplicarDeltas(
          nomina.empleadoId,
          deltasBanco,
          tx
        );
      }

      return created;
    });

    return { cantidadFilas, nominaId };
  }
}
