// src/services/ProrrateoService.ts
import type { Nomina, TipoProrrateo } from "@prisma/client";
import ExcelJS from "exceljs";
import { prisma } from "../config/prisma";
import { AppError } from "../errors/AppError";
import { HorarioTrabajoDomain } from "../domain/calculo-horas/horario-trabajo-domain";
import type {
  HorasPorJob,
  ConteoHorasValidationError,
} from "../domain/calculo-horas/types";
import { NominaRepository } from "../repositories/NominaRepository";
import { EmpresaRepository } from "../repositories/EmpresaRepository";
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
  repartirMontoDiasLaboradosConPermisoJustificado,
} from "../domain/calculo-horas/nominaMontos";

const TIPO_PRORRATEO_LABEL: Record<TipoProrrateo, string> = {
  normal: "Normal",
  extra25: "Extra 25%",
  extra50: "Extra 50%",
  extra75: "Extra 75%",
  extra100: "Extra 100%",
  compensatoriaTomada: "Comp. tomada",
  compensatoriaAcumulada: "Comp. acumulada",
};

const TIPO_PRORRATEO_ORDER: TipoProrrateo[] = [
  "normal",
  "extra25",
  "extra50",
  "extra75",
  "extra100",
  "compensatoriaTomada",
  "compensatoriaAcumulada",
];

const round2 = roundNomina2;

function toFechaStr(fecha: Date | string): string {
  if (fecha instanceof Date) return fecha.toISOString().split("T")[0];
  const s = String(fecha);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

/** True solo si hay al menos una lista de validación con elementos. */
function hasPendingValidations(
  ve?: ConteoHorasValidationError | null
): boolean {
  if (!ve) return false;
  return Object.values(ve).some(
    (arr) => Array.isArray(arr) && arr.length > 0
  );
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
  const horasProrrateables = totalHoras;

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

  static async listarGuardadosPorEmpleado(
    empleadoId: number,
    viewerEmpleadoId: number,
    viewerRolIds: number[]
  ) {
    if (!Number.isFinite(empleadoId) || empleadoId <= 0) {
      throw new AppError("empleadoId inválido", 400);
    }

    await AccesoContabilidadService.assertViewerCanAccessProrrateoEmpleado(
      viewerEmpleadoId,
      viewerRolIds,
      empleadoId
    );

    const rows =
      await ProrrateoRepository.listNominasGuardadasPorEmpleado(empleadoId);

    return rows.map((r) => ({
      nominaId: r.nominaId,
      nombrePeriodoNomina: r.nombrePeriodoNomina,
      fechaInicio: toFechaStr(r.fechaInicio),
      fechaFin: toFechaStr(r.fechaFin),
      codigoNomina: r.codigoNomina,
      cantidadFilas: r.cantidadFilas,
    }));
  }

  static async obtenerPorNomina(
    nominaId: number,
    viewerEmpleadoId: number,
    viewerRolIds: number[]
  ) {
    const nomina = await NominaRepository.findById(nominaId);
    if (!nomina || nomina.deletedAt) {
      throw new AppError("Nómina no encontrada", 404);
    }

    await AccesoContabilidadService.assertViewerCanAccessProrrateoEmpleado(
      viewerEmpleadoId,
      viewerRolIds,
      nomina.empleadoId
    );

    const filas = await ProrrateoRepository.findByNominaId(nominaId);
    if (filas.length === 0) {
      throw new AppError("No hay prorrateo guardado para esta nómina", 404);
    }

    return {
      nominaId: nomina.id,
      empleadoId: nomina.empleadoId,
      nombrePeriodoNomina: nomina.nombrePeriodoNomina,
      fechaInicio: toFechaStr(nomina.fechaInicio),
      fechaFin: toFechaStr(nomina.fechaFin),
      codigoNomina: nomina.codigoNomina,
      filas: filas.map((f) => ({
        id: f.id,
        jobId: f.jobId,
        codigoJob: f.codigoJob,
        codigoClass: f.codigoClass,
        cantidadHoras: f.cantidadHoras,
        monto: f.monto,
        tipo: f.tipo,
      })),
    };
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

    // validationErrors suele venir siempre como objeto (p. ej. arrays vacíos);
    // solo bloquear si hay fechas/mensajes reales pendientes.
    if (hasPendingValidations(conteo.validationErrors)) {
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

    const horasJobsNormales = (ch.normal ?? []).reduce(
      (acc, j) => acc + Number(j.cantidadHoras ?? 0),
      0
    );
    const horasPermisoJustificado = Number(ch.permisoConSueldoHoras ?? 0);
    const { montoJobsNormales } =
      repartirMontoDiasLaboradosConPermisoJustificado(
        Number(nomina.montoDiasLaborados ?? 0),
        horasJobsNormales,
        horasPermisoJustificado
      );

    const rows: ProrrateoCreateRow[] = [
      ...expandJobsToRows(
        ch.normal ?? [],
        "normal",
        nominaId,
        montoJobsNormales,
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

  private static roundMoney(n: number): number {
    return Math.round(n * 100) / 100;
  }

  private static totalBrutoNomina(nomina: Nomina): number {
    const horasExtra =
      (nomina.montoHoras25 ?? 0) +
      (nomina.montoHoras50 ?? 0) +
      (nomina.montoHoras75 ?? 0) +
      (nomina.montoHoras100 ?? 0);
    return this.roundMoney(
      (nomina.subtotalQuincena ?? 0) + horasExtra + (nomina.ajuste ?? 0)
    );
  }

  private static totalDeduccionesNomina(nomina: Nomina): number {
    if (nomina.totalDeducciones != null) {
      return Number(nomina.totalDeducciones);
    }
    return this.roundMoney(
      (nomina.deduccionIHSS ?? 0) +
        (nomina.deduccionISR ?? 0) +
        (nomina.deduccionRAP ?? 0) +
        (nomina.deduccionAlimentacion ?? 0) +
        (nomina.deduccionAlojamiento ?? 0) +
        (nomina.cobroPrestamo ?? 0) +
        (nomina.impuestoVecinal ?? 0) +
        (nomina.otros ?? 0)
    );
  }

  private static sanitizeSheetName(raw: string, used: Set<string>): string {
    let base = raw
      .replace(/[\\/*?:\[\]]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 31);
    if (!base) base = "Empleado";
    let name = base;
    let i = 2;
    while (used.has(name.toLowerCase())) {
      const suffix = ` (${i})`;
      name = `${base.slice(0, Math.max(1, 31 - suffix.length))}${suffix}`;
      i += 1;
    }
    used.add(name.toLowerCase());
    return name;
  }

  /** Primer token del apellido (ej. "García López" → "García"). */
  private static primerApellido(apellido: string | null | undefined): string {
    return (apellido ?? "").trim().split(/\s+/)[0] || "";
  }

  /**
   * Nombre de pestaña: solo nombre; si hay otro con el mismo nombre, añade primer apellido.
   */
  private static sheetNameFromEmpleado(
    empleado: { nombre: string; apellido?: string | null },
    nombreCounts: Map<string, number>,
    used: Set<string>
  ): string {
    const nombre = (empleado.nombre ?? "").trim() || "Empleado";
    const key = nombre.toLowerCase();
    const needsApellido = (nombreCounts.get(key) ?? 0) > 1;
    const apellido = this.primerApellido(empleado.apellido);
    const raw =
      needsApellido && apellido ? `${nombre} ${apellido}` : nombre;
    return this.sanitizeSheetName(raw, used);
  }

  /**
   * Excel multi-hoja: una pestaña por colaborador con desglose de nómina
   * y filas de prorrateo agrupadas por tipo (normal, extra25, …).
   */
  static async generarExcelPorEmpresaYCodigo(
    empresaId: number,
    codigoNomina: string,
    viewerEmpleadoId: number,
    viewerRolIds: number[]
  ): Promise<{ buffer: Buffer; filename: string }> {
    if (!Number.isFinite(empresaId) || empresaId <= 0) {
      throw new AppError("empresaId inválido", 400);
    }
    const codigo = String(codigoNomina || "").trim();
    if (!codigo) {
      throw new AppError("codigoNomina es requerido", 400);
    }

    await AccesoContabilidadService.assertCanAccessNominaEmpresa(
      viewerEmpleadoId,
      viewerRolIds,
      empresaId
    );

    const nominas =
      await ProrrateoRepository.findNominasConProrrateoPorPeriodo(
        empresaId,
        codigo
      );
    if (nominas.length === 0) {
      throw new AppError(
        "No hay prorrateos guardados para este período y empresa",
        404
      );
    }

    const ordenadas = [...nominas].sort((a, b) => {
      const na = `${a.empleado.nombre} ${a.empleado.apellido ?? ""}`.trim();
      const nb = `${b.empleado.nombre} ${b.empleado.apellido ?? ""}`.trim();
      return na.localeCompare(nb, "es", { sensitivity: "base" });
    });

    const empresa = await EmpresaRepository.findById(empresaId);
    const nombreEmpresa = empresa?.nombre?.trim() || `Empresa ${empresaId}`;

    const workbook = new ExcelJS.Workbook();
    const currencyFmt = '"L" #,##0.00';
    const fillGreen = {
      type: "pattern" as const,
      pattern: "solid" as const,
      fgColor: { argb: "FFE8F5E9" },
    };
    const fillGreenStrong = {
      type: "pattern" as const,
      pattern: "solid" as const,
      fgColor: { argb: "FFC8E6C9" },
    };
    const fillGreenTotalPagar = {
      type: "pattern" as const,
      pattern: "solid" as const,
      fgColor: { argb: "FFA5D6A7" },
    };
    const fillRed = {
      type: "pattern" as const,
      pattern: "solid" as const,
      fgColor: { argb: "FFFFEBEE" },
    };
    const fillRedStrong = {
      type: "pattern" as const,
      pattern: "solid" as const,
      fgColor: { argb: "FFFFCDD2" },
    };
    const usedSheetNames = new Set<string>();
    const nombreCounts = new Map<string, number>();
    for (const n of ordenadas) {
      const key = (n.empleado.nombre ?? "").trim().toLowerCase() || "empleado";
      nombreCounts.set(key, (nombreCounts.get(key) ?? 0) + 1);
    }

    for (const nomina of ordenadas) {
      const nombreEmpleado =
        `${nomina.empleado.nombre} ${nomina.empleado.apellido ?? ""}`.trim() ||
        `ID ${nomina.empleadoId}`;
      const codigoEmp = (nomina.empleado.codigo || "").trim();
      const sheetName = this.sheetNameFromEmpleado(
        nomina.empleado,
        nombreCounts,
        usedSheetNames
      );
      const sheet = workbook.addWorksheet(sheetName);
      // A-B desglose, C spacer, luego grupos Job|Horas|Monto + spacer delgado
      sheet.columns = [
        { width: 32 },
        { width: 16 },
        { width: 3 },
        // normal
        { width: 12 },
        { width: 10 },
        { width: 12 },
        { width: 2 },
        // extra25
        { width: 12 },
        { width: 10 },
        { width: 12 },
        { width: 2 },
        // extra50
        { width: 12 },
        { width: 10 },
        { width: 12 },
        { width: 2 },
        // extra75
        { width: 12 },
        { width: 10 },
        { width: 12 },
        { width: 2 },
        // extra100
        { width: 12 },
        { width: 10 },
        { width: 12 },
        { width: 2 },
        // comp tomada
        { width: 12 },
        { width: 10 },
        { width: 12 },
        { width: 2 },
        // comp acumulada
        { width: 12 },
        { width: 10 },
        { width: 12 },
      ];

      const fillGray = {
        type: "pattern" as const,
        pattern: "solid" as const,
        fgColor: { argb: "FFF5F5F5" },
      };
      const fillGrayStrong = {
        type: "pattern" as const,
        pattern: "solid" as const,
        fgColor: { argb: "FFE0E0E0" },
      };

      // Título y nombre centrados A–K
      sheet.mergeCells(1, 1, 1, 11);
      const titleCell = sheet.getRow(1).getCell(1);
      titleCell.value = `Prorrateo ${nombreEmpresa}`;
      titleCell.font = { bold: true, size: 14 };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };
      for (let c = 1; c <= 11; c++) {
        sheet.getRow(1).getCell(c).fill = fillGrayStrong;
      }

      sheet.mergeCells(2, 1, 2, 11);
      const nameCell = sheet.getRow(2).getCell(1);
      nameCell.value = nombreEmpleado;
      nameCell.font = { bold: true, size: 12 };
      nameCell.alignment = { horizontal: "center", vertical: "middle" };
      for (let c = 1; c <= 11; c++) {
        sheet.getRow(2).getCell(c).fill = fillGray;
      }

      const meta: Array<[string, string | number]> = [
        ["Código colaborador", codigoEmp || "—"],
        ["Empresa", nombreEmpresa],
        ["Código nómina", nomina.codigoNomina ?? codigo],
        [
          "Período",
          nomina.nombrePeriodoNomina?.trim() ||
            `${toFechaStr(nomina.fechaInicio)} → ${toFechaStr(nomina.fechaFin)}`,
        ],
        ["Fecha inicio", toFechaStr(nomina.fechaInicio)],
        ["Fecha fin", toFechaStr(nomina.fechaFin)],
      ];
      meta.forEach(([label, value], i) => {
        const r = sheet.getRow(3 + i);
        r.getCell(1).value = label;
        r.getCell(2).value = value;
        r.getCell(1).fill = fillGray;
        r.getCell(2).fill = fillGray;
      });

      const sectionStartRow = 10;

      let leftRow = sectionStartRow;
      const writeLeftLabel = (text: string, bold = false, size?: number) => {
        const cell = sheet.getRow(leftRow).getCell(1);
        cell.value = text;
        cell.font = { bold, ...(size ? { size } : {}) };
        cell.fill = fillGrayStrong;
        sheet.getRow(leftRow).getCell(2).fill = fillGrayStrong;
        leftRow += 1;
      };
      const writeLeftKV = (label: string, value: string | number | null) => {
        const r = sheet.getRow(leftRow);
        r.getCell(1).value = label;
        r.getCell(2).value = value ?? "—";
        r.getCell(1).fill = fillGray;
        r.getCell(2).fill = fillGray;
        leftRow += 1;
      };
      const writeLeftMoney = (
        label: string,
        value: number | null | undefined,
        fill?: ExcelJS.FillPattern
      ) => {
        const r = sheet.getRow(leftRow);
        r.getCell(1).value = label;
        const cell = r.getCell(2);
        cell.value = Number(value ?? 0);
        cell.numFmt = currencyFmt;
        const applied = fill ?? fillGray;
        r.getCell(1).fill = applied;
        cell.fill = applied;
        leftRow += 1;
      };

      writeLeftLabel("Desglose de nómina", true, 12);
      leftRow += 1; // fila intermedia bajo el título
      // Colorear la fila intermedia en gris
      sheet.getRow(leftRow - 1).getCell(1).fill = fillGray;
      sheet.getRow(leftRow - 1).getCell(2).fill = fillGray;
      writeLeftMoney("Sueldo mensual", nomina.sueldoMensual);
      writeLeftMoney(
        "Sueldo quincenal",
        this.roundMoney(Number(nomina.sueldoMensual ?? 0) / 2)
      );
      writeLeftKV("Días laborados", nomina.diasLaborados ?? "—");
      writeLeftKV("Días vacaciones", nomina.diasVacaciones ?? "—");
      writeLeftKV(
        "Días incap. empresa",
        nomina.diasIncapacidadEmpresa ?? "—"
      );
      writeLeftKV("Días incap. IHSS", nomina.diasIncapacidadIHSS ?? "—");
      writeLeftMoney("Monto días laborados", nomina.montoDiasLaborados, fillGreen);
      writeLeftMoney("Monto vacaciones", nomina.montoVacaciones, fillGreen);
      writeLeftMoney(
        "Monto incapacidad empresa",
        nomina.montoIncapacidadCubreEmpresa,
        fillGreen
      );
      writeLeftMoney("Extra 25%", nomina.montoHoras25, fillGreen);
      writeLeftMoney("Extra 50%", nomina.montoHoras50, fillGreen);
      writeLeftMoney("Extra 75%", nomina.montoHoras75, fillGreen);
      writeLeftMoney("Extra 100%", nomina.montoHoras100, fillGreen);
      writeLeftMoney("Ajuste", nomina.ajuste, fillGreen);
      const totalBruto = this.totalBrutoNomina(nomina);
      writeLeftMoney("Total Percepciones", totalBruto, fillGreenStrong);
      writeLeftMoney("Deducción IHSS", nomina.deduccionIHSS, fillRed);
      writeLeftMoney("Deducción ISR", nomina.deduccionISR, fillRed);
      writeLeftMoney("Deducción RAP", nomina.deduccionRAP, fillRed);
      writeLeftMoney(
        "Deducción alimentación",
        nomina.deduccionAlimentacion,
        fillRed
      );
      writeLeftMoney(
        "Deducción alojamiento",
        nomina.deduccionAlojamiento,
        fillRed
      );
      writeLeftMoney("Préstamo", nomina.cobroPrestamo, fillRed);
      writeLeftMoney("Impuesto vecinal", nomina.impuestoVecinal, fillRed);
      writeLeftMoney("Otros", nomina.otros, fillRed);
      const totalDed = this.totalDeduccionesNomina(nomina);
      writeLeftMoney("Total deducciones", totalDed, fillRedStrong);
      writeLeftMoney(
        "Total a pagar",
        this.roundMoney(totalBruto - totalDed),
        fillGreenTotalPagar
      );

      // —— Derecha: grupos Job | Horas | Monto, con columna delgada entre grupos ——
      // Normal D-F, spacer G, Extra25 H-J, spacer K, Extra50 L-N, …
      const TIPO_COL_START: Partial<Record<TipoProrrateo, number>> = {
        normal: 4,
        extra25: 8,
        extra50: 12,
        extra75: 16,
        extra100: 20,
        compensatoriaTomada: 24,
        compensatoriaAcumulada: 28,
      };
      const EXTRA_FACTOR: Partial<Record<TipoProrrateo, number>> = {
        extra25: 1.25,
        extra50: 1.5,
        extra75: 1.75,
        extra100: 2,
      };
      const TIPO_FILL: Partial<
        Record<TipoProrrateo, { header: string; row: string; total: string }>
      > = {
        normal: {
          header: "FFBBDEFB",
          row: "FFE3F2FD",
          total: "FF90CAF9",
        },
        extra25: {
          header: "FFC8E6C9",
          row: "FFE8F5E9",
          total: "FFA5D6A7",
        },
        extra50: {
          header: "FFFFE0B2",
          row: "FFFFF3E0",
          total: "FFFFCC80",
        },
        extra75: {
          header: "FFE1BEE7",
          row: "FFF3E5F5",
          total: "FFCE93D8",
        },
        extra100: {
          header: "FFF8BBD0",
          row: "FFFCE4EC",
          total: "FFF48FB1",
        },
        compensatoriaTomada: {
          header: "FFB2EBF2",
          row: "FFE0F7FA",
          total: "FF80DEEA",
        },
        compensatoriaAcumulada: {
          header: "FFFFECB3",
          row: "FFFFF8E1",
          total: "FFFFE082",
        },
      };

      const solidFill = (argb: string): ExcelJS.FillPattern => ({
        type: "pattern",
        pattern: "solid",
        fgColor: { argb },
      });
      const thinBlack: Partial<ExcelJS.Border> = {
        style: "thin",
        color: { argb: "FF000000" },
      };
      const applyOuterBorder = (
        startRow: number,
        endRow: number,
        startCol: number,
        endCol: number
      ) => {
        for (let r = startRow; r <= endRow; r++) {
          for (let c = startCol; c <= endCol; c++) {
            const cell = sheet.getRow(r).getCell(c);
            const border: Partial<ExcelJS.Borders> = { ...(cell.border || {}) };
            if (r === startRow) border.top = thinBlack as ExcelJS.Border;
            if (r === endRow) border.bottom = thinBlack as ExcelJS.Border;
            if (c === startCol) border.left = thinBlack as ExcelJS.Border;
            if (c === endCol) border.right = thinBlack as ExcelJS.Border;
            cell.border = border as ExcelJS.Borders;
          }
        }
      };
      const fillRange = (
        startRow: number,
        endRow: number,
        startCol: number,
        endCol: number,
        argb: string
      ) => {
        const fill = solidFill(argb);
        for (let r = startRow; r <= endRow; r++) {
          for (let c = startCol; c <= endCol; c++) {
            sheet.getRow(r).getCell(c).fill = fill;
          }
        }
      };

      const sueldoMensual = Number(nomina.sueldoMensual ?? 0);
      const diasLab = Number(nomina.diasLaborados ?? 0);
      const montoDias = Number(nomina.montoDiasLaborados ?? 0);
      const precioHoraBase = sueldoMensual / (30 * 8);
      const precioHoraNormal =
        diasLab > 0 ? montoDias / (diasLab * 8) : 0;

      const precioHoraDeTipo = (tipo: TipoProrrateo): number => {
        if (tipo === "normal") return round2(precioHoraNormal);
        const factor = EXTRA_FACTOR[tipo];
        if (factor != null) return round2(precioHoraBase * factor);
        return round2(precioHoraBase);
      };

      const byTipo = new Map<TipoProrrateo, typeof nomina.prorrateos>();
      for (const f of nomina.prorrateos) {
        const list = byTipo.get(f.tipo) ?? [];
        list.push(f);
        byTipo.set(f.tipo, list);
      }

      const tiposAMostrar: TipoProrrateo[] = [
        "normal",
        "extra25",
        "extra50",
        "extra75",
        "extra100",
        ...(byTipo.has("compensatoriaTomada")
          ? (["compensatoriaTomada"] as TipoProrrateo[])
          : []),
        ...(byTipo.has("compensatoriaAcumulada")
          ? (["compensatoriaAcumulada"] as TipoProrrateo[])
          : []),
      ];

      const titleRow = sectionStartRow;
      sheet.mergeCells(titleRow, 4, titleRow, 11);
      const detalleTitle = sheet.getRow(titleRow).getCell(4);
      detalleTitle.value = "Detalle de prorrateo";
      detalleTitle.font = { bold: true, size: 12 };
      detalleTitle.alignment = { horizontal: "left", vertical: "middle" };
      for (let c = 4; c <= 11; c++) {
        sheet.getRow(titleRow).getCell(c).fill = fillGrayStrong;
      }
      // fila intermedia bajo el título de detalle
      for (let c = 4; c <= 11; c++) {
        sheet.getRow(titleRow + 1).getCell(c).fill = fillGray;
      }

      // fila intermedia bajo el título; tablas empiezan después
      const headerTipoRow = titleRow + 2;
      const precioRow = headerTipoRow + 1;
      const colHeaderRow = precioRow + 2; // fila vacía entre precio y encabezados
      const dataStartRow = colHeaderRow + 1;

      for (const tipo of tiposAMostrar) {
        const colJob = TIPO_COL_START[tipo];
        if (colJob == null) continue;
        const colHoras = colJob + 1;
        const colMonto = colJob + 2;
        const colors = TIPO_FILL[tipo] ?? {
          header: "FFE0E0E0",
          row: "FFF5F5F5",
          total: "FFBDBDBD",
        };

        const filas = byTipo.get(tipo) ?? [];
        const aggPorJob = new Map<string, { horas: number; monto: number }>();
        for (const f of filas) {
          const job = (f.codigoJob || "").trim() || "—";
          const prev = aggPorJob.get(job) ?? { horas: 0, monto: 0 };
          aggPorJob.set(job, {
            horas: round2(prev.horas + Number(f.cantidadHoras ?? 0)),
            monto: round2(prev.monto + Number(f.monto ?? 0)),
          });
        }
        const totalHoras = round2(
          [...aggPorJob.values()].reduce((s, n) => s + n.horas, 0)
        );
        const totalMonto = round2(
          [...aggPorJob.values()].reduce((s, n) => s + n.monto, 0)
        );
        const precioHora = precioHoraDeTipo(tipo);

        // Título del tipo (fila completa del grupo)
        fillRange(headerTipoRow, headerTipoRow, colJob, colMonto, colors.header);
        const cellTipo = sheet.getRow(headerTipoRow).getCell(colJob);
        cellTipo.value = TIPO_PRORRATEO_LABEL[tipo];
        cellTipo.font = { bold: true };

        // Precio hora
        fillRange(precioRow, precioRow, colJob, colMonto, colors.row);
        sheet.getRow(precioRow).getCell(colJob).value = "Precio hora";
        const cellPrecio = sheet.getRow(precioRow).getCell(colMonto);
        cellPrecio.value = precioHora;
        cellPrecio.numFmt = currencyFmt;

        // Fila intermedia vacía (separación visual) dentro del marco
        const blankSepRow = precioRow + 1;
        fillRange(blankSepRow, blankSepRow, colJob, colMonto, colors.row);

        // Encabezados Job | Horas | Monto
        fillRange(colHeaderRow, colHeaderRow, colJob, colMonto, colors.header);
        const hdr = sheet.getRow(colHeaderRow);
        hdr.getCell(colJob).value = "Job";
        hdr.getCell(colJob).font = { bold: true };
        hdr.getCell(colHoras).value = "Horas";
        hdr.getCell(colHoras).font = { bold: true };
        hdr.getCell(colMonto).value = "Monto";
        hdr.getCell(colMonto).font = { bold: true };

        const jobKeys = [...aggPorJob.keys()].sort((a, b) =>
          a.localeCompare(b, "es", { sensitivity: "base" })
        );
        jobKeys.forEach((job, idx) => {
          const rIdx = dataStartRow + idx;
          fillRange(rIdx, rIdx, colJob, colMonto, colors.row);
          const r = sheet.getRow(rIdx);
          const agg = aggPorJob.get(job)!;
          r.getCell(colJob).value = job;
          r.getCell(colHoras).value = agg.horas;
          const m = r.getCell(colMonto);
          m.value = agg.monto;
          m.numFmt = currencyFmt;
        });

        const totalExcelRow = dataStartRow + Math.max(jobKeys.length, 0);
        fillRange(totalExcelRow, totalExcelRow, colJob, colMonto, colors.total);
        const tot = sheet.getRow(totalExcelRow);
        tot.getCell(colJob).value = "Total";
        tot.getCell(colJob).font = { bold: true };
        tot.getCell(colHoras).value = totalHoras;
        tot.getCell(colHoras).font = { bold: true };
        const totMonto = tot.getCell(colMonto);
        totMonto.value = totalMonto;
        totMonto.numFmt = currencyFmt;
        totMonto.font = { bold: true };

        // Enmarcar toda la tablita (incluye fila vacía entre precio y headers)
        applyOuterBorder(headerTipoRow, totalExcelRow, colJob, colMonto);
      }
    }
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const safeEmpresa = nombreEmpresa
      .replace(/[\\/:*?"<>|]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const filename = `Prorrateo ${codigo} ${safeEmpresa}.xlsx`;
    return { buffer, filename };
  }
}
