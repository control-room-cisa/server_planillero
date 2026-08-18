// src/services/NominaService.ts
import type { Nomina, Prisma } from "@prisma/client";
import ExcelJS from "exceljs";
import { NominaRepository } from "../repositories/NominaRepository";
import type {
  CrearNominaDto,
  ActualizarNominaDto,
} from "../validators/nomina.validator";
import { AppError } from "../errors/AppError";
import { EmpleadoRepository } from "../repositories/EmpleadoRepository";
import { RegistroDiarioService } from "./RegistroDiarioService";
import { BancoCompensatoriasRepository } from "../repositories/BancoCompensatoriasRepository";
import { prisma } from "../config/prisma";

type BancoCompensatoriaAplicada = { jobId: number | null; horas: number };

function parseBancoCompensatoriasAplicadas(
  value: unknown
): BancoCompensatoriaAplicada[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const jobId =
        item?.jobId === null || item?.jobId === undefined
          ? null
          : Number(item.jobId);
      const horas = Number(item?.horas);
      return {
        jobId: jobId !== null && Number.isFinite(jobId) ? jobId : null,
        horas: Number.isFinite(horas) ? horas : 0,
      };
    })
    .filter((item) => item.horas !== 0);
}

function toFechaStr(fecha: Date | string): string {
  if (fecha instanceof Date) return fecha.toISOString().split("T")[0];
  return String(fecha).split("T")[0];
}

function toDate(fecha: Date | string): Date {
  return fecha instanceof Date ? fecha : new Date(fecha);
}

function coalesce<T>(incoming: T | undefined, current: T): T {
  return incoming !== undefined ? incoming : current;
}

// Función para generar código de nómina: YYYYMMP
// YYYY = año, MM = mes (01-12), P = período (A primera quincena, B segunda quincena)
function generarCodigoNomina(fechaInicio: Date, fechaFin: Date): string {
  const inicio =
    fechaInicio instanceof Date ? fechaInicio : new Date(fechaInicio);
  const fin = fechaFin instanceof Date ? fechaFin : new Date(fechaFin);

  const diaFin = fin.getDate();
  const diaInicio = inicio.getDate();

  // Determinar período: A (primera quincena) o B (segunda quincena)
  // Primera quincena: días 27-11 (del mes siguiente) → usar mes del fin
  // Segunda quincena: días 12-26 → usar mes del fin
  let periodo: string;
  let año: number;
  let mes: string;

  if (diaFin === 11 || diaInicio === 27) {
    // Primera quincena: 27 del mes anterior al 11 del mes actual
    periodo = "A";
    año = fin.getFullYear();
    mes = String(fin.getMonth() + 1).padStart(2, "0");
  } else if (diaFin === 26 || diaInicio === 12) {
    // Segunda quincena: 12-26 del mismo mes
    periodo = "B";
    año = fin.getFullYear();
    mes = String(fin.getMonth() + 1).padStart(2, "0");
  } else {
    // Fallback: usar mes del fin
    año = fin.getFullYear();
    mes = String(fin.getMonth() + 1).padStart(2, "0");
    periodo = diaFin <= 15 ? "A" : "B";
  }

  return `${año}${mes}${periodo}`;
}

export class NominaService {
  private static horasVacacionesFromDias(diasVacaciones?: number | null): number {
    return Number(diasVacaciones ?? 0) * 8;
  }

  /**
   * Ajusta solo vacaciones en Empleado (tiempoVacacionesHoras).
   * tiempoCompensatorioHoras queda aislado: el banco por job es la fuente actual.
   */
  private static async ajustarVacacionesEmpleado(
    empleadoId: number,
    deltaVacHoras: number,
    tx: Prisma.TransactionClient | typeof prisma = prisma
  ): Promise<void> {
    const dVac = Number(deltaVacHoras || 0);
    if (dVac === 0) return;

    const empleado = await tx.empleado.findFirst({
      where: { id: empleadoId, deletedAt: null },
      select: { tiempoVacacionesHoras: true },
    });
    if (!empleado) return;

    const vacActual = empleado.tiempoVacacionesHoras ?? 0;
    await tx.empleado.update({
      where: { id: empleadoId },
      data: { tiempoVacacionesHoras: vacActual + dVac },
    });
  }

  /**
   * Efectos al crear: descuenta vacaciones, aplica snapshot al banco y aprueba RRHH del período.
   */
  private static async aplicarEfectosAlCrear(
    params: {
      empleadoId: number;
      fechaInicio: Date | string;
      fechaFin: Date | string;
      diasVacaciones?: number | null;
      bancoAplicadas: BancoCompensatoriaAplicada[];
    },
    tx: Prisma.TransactionClient
  ): Promise<void> {
    await this.ajustarVacacionesEmpleado(
      params.empleadoId,
      -this.horasVacacionesFromDias(params.diasVacaciones),
      tx
    );
    if (params.bancoAplicadas.length > 0) {
      await BancoCompensatoriasRepository.aplicarDeltas(
        params.empleadoId,
        params.bancoAplicadas,
        tx
      );
    }
    await RegistroDiarioService.aprobarRrhhByDateRange(
      params.empleadoId,
      toFechaStr(params.fechaInicio),
      toFechaStr(params.fechaFin),
      undefined,
      tx
    );
  }

  /**
   * Efectos al archivar: devuelve vacaciones, revierte el banco y quita aprobación RRHH del período.
   */
  private static async revertirEfectosAlArchivar(
    nomina: Nomina,
    tx: Prisma.TransactionClient
  ): Promise<void> {
    const bancoAplicadas = parseBancoCompensatoriasAplicadas(
      nomina.bancoCompensatoriasAplicadas
    );
    const deltasReverso = bancoAplicadas.map((item) => ({
      jobId: item.jobId,
      horas: -item.horas,
    }));

    await this.ajustarVacacionesEmpleado(
      nomina.empleadoId,
      this.horasVacacionesFromDias(nomina.diasVacaciones),
      tx
    );
    if (deltasReverso.length > 0) {
      await BancoCompensatoriasRepository.aplicarDeltas(
        nomina.empleadoId,
        deltasReverso,
        tx
      );
    }
    await RegistroDiarioService.revertirRrhhApprovalByDateRange(
      nomina.empleadoId,
      toFechaStr(nomina.fechaInicio),
      toFechaStr(nomina.fechaFin),
      tx
    );
  }

  private static async archivarNomina(
    nomina: Nomina,
    deletedBy: number | null | undefined,
    tx: Prisma.TransactionClient
  ): Promise<Nomina> {
    const archived = await tx.nomina.update({
      where: { id: nomina.id },
      data: {
        deletedAt: new Date(),
        deletedBy: deletedBy ?? null,
      },
    });
    await this.revertirEfectosAlArchivar(nomina, tx);
    return archived;
  }

  static async getById(id: number): Promise<Nomina> {
    const found = await NominaRepository.findById(id);
    if (!found) throw new AppError("Nómina no encontrada", 404);
    return found;
  }

  static async list(params: {
    empleadoId?: number;
    empresaId?: number;
    start?: string;
    end?: string;
    codigoNomina?: string;
  }): Promise<Nomina[]> {
    return NominaRepository.findMany(params);
  }

  static async create(
    payload: CrearNominaDto,
    createdBy?: number | null
  ): Promise<Nomina> {
    // Resolver empresa desde el empleado (departamento -> empresa)
    const empleado = await EmpleadoRepository.findById(payload.empleadoId);
    if (!empleado?.departamentoId) {
      throw new AppError("Empleado sin departamento asociado", 400);
    }
    
    // El empleado ya viene con la relación departamento incluida (desde EmpleadoRepository.findById)
    // Intentar obtener empresaId desde el departamento incluido primero
    let empresaId = (empleado as any).departamento?.empresaId;
    
    // Fallback: si no viene en la relación, consultar directamente
    // Esto puede pasar si el departamento está eliminado (soft delete) pero el empleado aún lo referencia
    if (!empresaId) {
      console.log(
        `[NominaService] Departamento no incluido en relación, consultando directamente. EmpleadoId: ${payload.empleadoId}, DepartamentoId: ${empleado.departamentoId}`
      );
      
      const depto = await (async () => {
        return await (
          await import("../config/prisma")
        ).prisma.departamento.findFirst({
          where: { 
            id: empleado.departamentoId,
            deletedAt: null, // Incluir solo departamentos no eliminados
          },
          select: { empresaId: true },
        });
      })();
      
      console.log(
        `[NominaService] Resultado consulta departamento:`,
        depto ? { empresaId: depto.empresaId } : "null (no encontrado o eliminado)"
      );
      
      empresaId = depto?.empresaId;
      
      if (!empresaId) {
        // Consultar sin filtro de soft delete para diagnosticar
        const deptoConDeleted = await (async () => {
          return await (
            await import("../config/prisma")
          ).prisma.$queryRawUnsafe(
            `SELECT id, empresa_id, deleted_at FROM departamentos WHERE id = ${empleado.departamentoId} LIMIT 1`
          ) as any[];
        })();
        
        console.log(
          `[NominaService] Consulta sin filtro soft delete:`,
          deptoConDeleted?.[0]
        );
        
        throw new AppError(
          `No se pudo resolver la empresa del empleado. EmpleadoId: ${payload.empleadoId}, DepartamentoId: ${empleado.departamentoId}. El departamento puede estar eliminado (soft delete) o no tener empresa asignada.`,
          400
        );
      }
    }

    // Generar código de nómina
    const fechaInicioDate =
      payload.fechaInicio instanceof Date
        ? payload.fechaInicio
        : new Date(payload.fechaInicio);
    const fechaFinDate =
      payload.fechaFin instanceof Date
        ? payload.fechaFin
        : new Date(payload.fechaFin);
    const codigoNomina = generarCodigoNomina(fechaInicioDate, fechaFinDate);

    const duplicadaPorCodigo =
      await NominaRepository.findActiveByEmpleadoAndCodigo(
        payload.empleadoId,
        codigoNomina
      );
    if (duplicadaPorCodigo) {
      throw new AppError(
        `Ya existe una nómina activa para este colaborador en el período ${codigoNomina}`,
        400
      );
    }

    // Validar solapamientos: solo considerar nóminas no eliminadas (deletedAt IS NULL)
    const overlapping = await NominaRepository.findOverlapping(
      payload.empleadoId,
      fechaInicioDate,
      fechaFinDate
    );
    if (overlapping.length > 0) {
      throw new AppError(
        "Ya existe una nómina activa que traslapa con el período seleccionado",
        400
      );
    }

    // Prisma types: map DTO to create input usando spread para reducir código
    const bancoAplicadas = parseBancoCompensatoriasAplicadas(
      payload.bancoCompensatoriasAplicadas
    );
    const camposOpcionales = {
      diasLaborados: payload.diasLaborados ?? null,
      diasVacaciones: payload.diasVacaciones ?? null,
      diasIncapacidadEmpresa: payload.diasIncapacidadEmpresa ?? null,
      diasIncapacidadIHSS: payload.diasIncapacidadIHSS ?? null,
      horasCompensatorias: payload.horasCompensatorias ?? null,
      bancoCompensatoriasAplicadas: bancoAplicadas,
      subtotalQuincena: payload.subtotalQuincena ?? null,
      montoVacaciones: payload.montoVacaciones ?? null,
      montoDiasLaborados: payload.montoDiasLaborados ?? null,
      montoExcedenteIHSS: payload.montoExcedenteIHSS ?? null,
      montoIncapacidadCubreEmpresa:
        payload.montoIncapacidadCubreEmpresa ?? null,
      montoPermisosJustificados: payload.montoPermisosJustificados ?? null,
      montoHoras25: payload.montoHoras25 ?? null,
      montoHoras50: payload.montoHoras50 ?? null,
      montoHoras75: payload.montoHoras75 ?? null,
      montoHoras100: payload.montoHoras100 ?? null,
      ajuste: payload.ajuste ?? null,
      totalPercepciones: payload.totalPercepciones ?? null,
      deduccionIHSS: payload.deduccionIHSS ?? null,
      deduccionISR: payload.deduccionISR ?? null,
      deduccionRAP: payload.deduccionRAP ?? null,
      deduccionAlimentacion: payload.deduccionAlimentacion ?? null,
      deduccionAlojamiento: payload.deduccionAlojamiento ?? null,
      cobroPrestamo: payload.cobroPrestamo ?? null,
      impuestoVecinal: payload.impuestoVecinal ?? null,
      otros: payload.otros ?? null,
      totalDeducciones: payload.totalDeducciones ?? null,
      totalNetoPagar: payload.totalNetoPagar ?? null,
      comentario: payload.comentario ?? null,
    };

    return prisma.$transaction(async (tx) => {
      const created = await tx.nomina.create({
        data: {
          empleado: { connect: { id: payload.empleadoId } },
          empresa: { connect: { id: empresaId } },
          nombrePeriodoNomina: payload.nombrePeriodoNomina ?? null,
          codigoNomina: codigoNomina,
          fechaInicio: payload.fechaInicio,
          fechaFin: payload.fechaFin,
          sueldoMensual: payload.sueldoMensual,
          ...(createdBy
            ? { createdByEmpleado: { connect: { id: createdBy } } }
            : {}),
          ...camposOpcionales,
        },
      });

      await this.aplicarEfectosAlCrear(
        {
          empleadoId: payload.empleadoId,
          fechaInicio: payload.fechaInicio,
          fechaFin: payload.fechaFin,
          diasVacaciones: payload.diasVacaciones,
          bancoAplicadas,
        },
        tx
      );

      return created;
    });
  }

  /**
   * Actualizar = archivar la nómina vigente y crear una nueva en la misma transacción.
   *
   * Vacaciones y compensatorias no se ajustan por delta sobre el registro vivo:
   * 1) se revierten los efectos de la nómina archivada
   * 2) se aplican los de la nueva
   *
   * Casos:
   * - Mismos días de vacaciones: +horas viejas −horas nuevas = 0.
   * - Suben vacaciones: se devuelve el saldo viejo y se descuenta el nuevo (neto = extra).
   * - Bajan o quedan en 0: se devuelve la diferencia al colaborador.
   * - Compensatorias acumuladas: el snapshot nuevo (o el de la archivada si no se envía)
   *   se revierte del banco y se reaplica. Tomadas no mueven el banco (solo el neto
   *   en horasCompensatorias, igual que el dashboard).
   * - Cambio de fechas: se desaprueba RRHH del rango viejo y se aprueba el nuevo.
   * - Mismo período: revertir + reaprobar deja la aprobación RRHH igual.
   * - Nómina pagada: no se edita (el prorrateo queda amarrado al id archivado).
   * - Falla a mitad: el $transaction revierte archivo, saldos y la fila nueva.
   */
  static async update(
    id: number,
    payload: ActualizarNominaDto,
    updatedBy?: number | null
  ): Promise<Nomina> {
    const existing = await NominaRepository.findById(id);
    if (!existing) throw new AppError("Nómina no encontrada", 404);

    if (existing.pagado) {
      throw new AppError(
        "No se puede editar una nómina que ya ha sido pagada",
        400
      );
    }

    if (
      "empleadoId" in (payload as object) &&
      (payload as { empleadoId?: number }).empleadoId != null &&
      (payload as { empleadoId?: number }).empleadoId !== existing.empleadoId
    ) {
      throw new AppError(
        "No se puede cambiar el colaborador de una nómina existente",
        400
      );
    }

    const empleadoId = existing.empleadoId;
    const fechaInicio = toDate(
      coalesce(payload.fechaInicio, existing.fechaInicio)
    );
    const fechaFin = toDate(coalesce(payload.fechaFin, existing.fechaFin));
    const codigoNomina = generarCodigoNomina(fechaInicio, fechaFin);

    const duplicadaPorCodigo =
      await NominaRepository.findActiveByEmpleadoAndCodigo(
        empleadoId,
        codigoNomina,
        id
      );
    if (duplicadaPorCodigo) {
      throw new AppError(
        `Ya existe una nómina activa para este colaborador en el período ${codigoNomina}`,
        400
      );
    }

    const overlapping = await NominaRepository.findOverlapping(
      empleadoId,
      fechaInicio,
      fechaFin,
      id
    );
    if (overlapping.length > 0) {
      throw new AppError(
        "Ya existe una nómina activa que traslapa con el período seleccionado",
        400
      );
    }

    const diasVacaciones = coalesce(
      payload.diasVacaciones,
      existing.diasVacaciones
    );
    const bancoAplicadas = parseBancoCompensatoriasAplicadas(
      payload.bancoCompensatoriasAplicadas !== undefined
        ? payload.bancoCompensatoriasAplicadas
        : existing.bancoCompensatoriasAplicadas
    );
    const horasCompensatorias = coalesce(
      payload.horasCompensatorias,
      existing.horasCompensatorias
    );

    return prisma.$transaction(async (tx) => {
      await this.archivarNomina(existing, updatedBy, tx);

      const created = await tx.nomina.create({
        data: {
          empleado: { connect: { id: empleadoId } },
          empresa: { connect: { id: existing.empresaId } },
          nombrePeriodoNomina: coalesce(
            payload.nombrePeriodoNomina,
            existing.nombrePeriodoNomina
          ),
          codigoNomina,
          fechaInicio,
          fechaFin,
          sueldoMensual: coalesce(payload.sueldoMensual, existing.sueldoMensual),
          ...(updatedBy
            ? { createdByEmpleado: { connect: { id: updatedBy } } }
            : existing.createdBy
              ? { createdByEmpleado: { connect: { id: existing.createdBy } } }
              : {}),
          diasLaborados: coalesce(payload.diasLaborados, existing.diasLaborados),
          diasVacaciones,
          diasIncapacidadEmpresa: coalesce(
            payload.diasIncapacidadEmpresa,
            existing.diasIncapacidadEmpresa
          ),
          diasIncapacidadIHSS: coalesce(
            payload.diasIncapacidadIHSS,
            existing.diasIncapacidadIHSS
          ),
          horasCompensatorias,
          bancoCompensatoriasAplicadas: bancoAplicadas,
          subtotalQuincena: coalesce(
            payload.subtotalQuincena,
            existing.subtotalQuincena
          ),
          montoVacaciones: coalesce(
            payload.montoVacaciones,
            existing.montoVacaciones
          ),
          montoDiasLaborados: coalesce(
            payload.montoDiasLaborados,
            existing.montoDiasLaborados
          ),
          montoExcedenteIHSS: coalesce(
            payload.montoExcedenteIHSS,
            existing.montoExcedenteIHSS
          ),
          montoIncapacidadCubreEmpresa: coalesce(
            payload.montoIncapacidadCubreEmpresa,
            existing.montoIncapacidadCubreEmpresa
          ),
          montoPermisosJustificados: coalesce(
            payload.montoPermisosJustificados,
            existing.montoPermisosJustificados
          ),
          montoHoras25: coalesce(payload.montoHoras25, existing.montoHoras25),
          montoHoras50: coalesce(payload.montoHoras50, existing.montoHoras50),
          montoHoras75: coalesce(payload.montoHoras75, existing.montoHoras75),
          montoHoras100: coalesce(payload.montoHoras100, existing.montoHoras100),
          ajuste: coalesce(payload.ajuste, existing.ajuste),
          totalPercepciones: coalesce(
            payload.totalPercepciones,
            existing.totalPercepciones
          ),
          deduccionIHSS: coalesce(payload.deduccionIHSS, existing.deduccionIHSS),
          deduccionISR: coalesce(payload.deduccionISR, existing.deduccionISR),
          deduccionRAP: coalesce(payload.deduccionRAP, existing.deduccionRAP),
          deduccionAlimentacion: coalesce(
            payload.deduccionAlimentacion,
            existing.deduccionAlimentacion
          ),
          deduccionAlojamiento: coalesce(
            payload.deduccionAlojamiento,
            existing.deduccionAlojamiento
          ),
          cobroPrestamo: coalesce(payload.cobroPrestamo, existing.cobroPrestamo),
          impuestoVecinal: coalesce(
            payload.impuestoVecinal,
            existing.impuestoVecinal
          ),
          otros: coalesce(payload.otros, existing.otros),
          totalDeducciones: coalesce(
            payload.totalDeducciones,
            existing.totalDeducciones
          ),
          totalNetoPagar: coalesce(
            payload.totalNetoPagar,
            existing.totalNetoPagar
          ),
          comentario: coalesce(payload.comentario, existing.comentario),
          pagado: false,
        },
      });

      await this.aplicarEfectosAlCrear(
        {
          empleadoId,
          fechaInicio,
          fechaFin,
          diasVacaciones,
          bancoAplicadas,
        },
        tx
      );

      return created;
    });
  }

  static async delete(id: number, deletedBy?: number | null): Promise<Nomina> {
    const existing = await NominaRepository.findById(id);
    if (!existing) throw new AppError("Nómina no encontrada", 404);

    if (existing.pagado) {
      throw new AppError(
        "No se puede eliminar una nómina que ya ha sido pagada",
        400
      );
    }

    return prisma.$transaction(async (tx) => {
      return this.archivarNomina(existing, deletedBy, tx);
    });
  }

  private static calcularTotalBruto(nomina: Nomina): number {
    const horasExtra =
      (nomina.montoHoras25 ?? 0) +
      (nomina.montoHoras50 ?? 0) +
      (nomina.montoHoras75 ?? 0) +
      (nomina.montoHoras100 ?? 0);
    return (
      Math.round(
        ((nomina.subtotalQuincena ?? 0) + horasExtra + (nomina.ajuste ?? 0)) *
          100
      ) / 100
    );
  }

  private static calcularTotalDeducciones(nomina: Nomina): number {
    if (nomina.totalDeducciones != null) {
      return Number(nomina.totalDeducciones);
    }
    return (
      Math.round(
        ((nomina.deduccionIHSS ?? 0) +
          (nomina.deduccionISR ?? 0) +
          (nomina.deduccionRAP ?? 0) +
          (nomina.deduccionAlimentacion ?? 0) +
          (nomina.deduccionAlojamiento ?? 0) +
          (nomina.cobroPrestamo ?? 0) +
          (nomina.impuestoVecinal ?? 0) +
          (nomina.otros ?? 0)) *
          100
      ) / 100
    );
  }

  private static calcularTotalHorasExtra(nomina: Nomina): number {
    return (
      Math.round(
        ((nomina.montoHoras25 ?? 0) +
          (nomina.montoHoras50 ?? 0) +
          (nomina.montoHoras75 ?? 0) +
          (nomina.montoHoras100 ?? 0)) *
          100
      ) / 100
    );
  }

  private static calcularTotalAPagar(nomina: Nomina): number {
    return (
      Math.round(
        (this.calcularTotalBruto(nomina) -
          this.calcularTotalDeducciones(nomina)) *
          100
      ) / 100
    );
  }

  private static round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private static formatFechaUtc(value: Date): string {
    return value.toLocaleDateString("es-HN", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }

  static async generarPlantillaPagoXlsx(
    empresaId: number,
    codigoNomina: string
  ): Promise<Buffer> {
    const nominas = await NominaRepository.findManyWithEmpleadoForPeriodo(
      empresaId,
      codigoNomina
    );
    if (nominas.length === 0) {
      throw new AppError(
        "No hay nóminas registradas para el período seleccionado",
        404
      );
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Plantilla");

    nominas.forEach((n, index) => {
      const emp = n.empleado;
      const row = sheet.getRow(index + 1);
      const cuentaCell = row.getCell(1);
      cuentaCell.value = emp.numeroCuenta ?? "";
      cuentaCell.numFmt = "@";
      row.getCell(2).value = this.calcularTotalAPagar(n);
      row.getCell(3).value = `${emp.nombre} ${emp.apellido ?? ""}`.trim();
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  static async generarDetalleNominaXlsx(
    id: number
  ): Promise<{ buffer: Buffer; filename: string }> {
    const nomina = await NominaRepository.findById(id);
    if (!nomina) {
      throw new AppError("Nómina no encontrada", 404);
    }

    const empleado = await EmpleadoRepository.findById(nomina.empleadoId);
    const nombreEmpleado = empleado
      ? `${empleado.nombre} ${empleado.apellido ?? ""}`.trim()
      : `ID: ${nomina.empleadoId}`;

    const formatDate = (value: Date) =>
      value.toLocaleDateString("es-HN", {
        timeZone: "UTC",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });

    const formatCurrency = (amount: number | null | undefined) => {
      if (amount === null || amount === undefined) return "-";
      return new Intl.NumberFormat("es-HN", {
        style: "currency",
        currency: "HNL",
      }).format(amount);
    };

    const formatDays = (value: number | null | undefined) => {
      if (value === null || value === undefined) return "-";
      return value;
    };

    const totalBruto = this.calcularTotalBruto(nomina);
    const totalDeducciones = this.calcularTotalDeducciones(nomina);
    const totalAPagar = this.calcularTotalAPagar(nomina);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Detalle");
    sheet.columns = [{ width: 34 }, { width: 28 }];

    let rowIndex = 1;
    const titleRow = sheet.getRow(rowIndex);
    sheet.mergeCells(rowIndex, 1, rowIndex, 2);
    titleRow.getCell(1).value = `Detalles de Nómina - ${
      nomina.nombrePeriodoNomina ?? "Sin nombre"
    }`;
    titleRow.getCell(1).font = { bold: true, size: 14 };
    rowIndex += 2;

    const addSection = (
      title: string,
      fields: Array<[string, string | number]>
    ) => {
      const sectionRow = sheet.getRow(rowIndex);
      sectionRow.getCell(1).value = title;
      sectionRow.getCell(1).font = { bold: true, size: 12 };
      rowIndex += 1;

      for (const [label, value] of fields) {
        const row = sheet.getRow(rowIndex);
        row.getCell(1).value = label;
        row.getCell(2).value = value;
        rowIndex += 1;
      }
      rowIndex += 1;
    };

    addSection("Información General", [
      ["Colaborador", nombreEmpleado],
      ["Período", nomina.nombrePeriodoNomina ?? "Sin nombre"],
      ["Estado", nomina.pagado ? "Pagado" : "Pendiente"],
      ["Fecha Inicio", formatDate(nomina.fechaInicio)],
      ["Fecha Fin", formatDate(nomina.fechaFin)],
    ]);

    addSection("Datos Base", [
      ["Sueldo Mensual", formatCurrency(nomina.sueldoMensual)],
      ["Días Laborados", formatDays(nomina.diasLaborados)],
      ["Días Vacaciones", formatDays(nomina.diasVacaciones)],
      ["Días incap. empresa", formatDays(nomina.diasIncapacidadEmpresa)],
      ["Días incap. IHSS", formatDays(nomina.diasIncapacidadIHSS)],
    ]);

    addSection("Percepciones", [
      ["Subtotal Quincena", formatCurrency(nomina.subtotalQuincena)],
      ["Monto Vacaciones", formatCurrency(nomina.montoVacaciones)],
      ["Monto Días Laborados", formatCurrency(nomina.montoDiasLaborados)],
      ["Total Bruto", formatCurrency(totalBruto)],
    ]);

    addSection("Horas Extra", [
      ["OT 25%", formatCurrency(nomina.montoHoras25)],
      ["OT 50%", formatCurrency(nomina.montoHoras50)],
      ["OT 75%", formatCurrency(nomina.montoHoras75)],
      ["OT 100%", formatCurrency(nomina.montoHoras100)],
    ]);

    addSection("Deducciones", [
      ["Deducción IHSS", formatCurrency(nomina.deduccionIHSS)],
      ["Deducción ISR", formatCurrency(nomina.deduccionISR)],
      ["Deducción RAP", formatCurrency(nomina.deduccionRAP)],
      ["Deducción Alimentación", formatCurrency(nomina.deduccionAlimentacion)],
      ["Deducción Alojamiento", formatCurrency(nomina.deduccionAlojamiento)],
      ["Cobro Préstamo", formatCurrency(nomina.cobroPrestamo)],
      ["Impuesto Vecinal", formatCurrency(nomina.impuestoVecinal)],
      ["Otros", formatCurrency(nomina.otros)],
      ["Ajuste", formatCurrency(nomina.ajuste)],
      ["Total Deducciones", formatCurrency(totalDeducciones)],
    ]);

    addSection("Total a Pagar", [["Total a Pagar", formatCurrency(totalAPagar)]]);

    if (nomina.comentario) {
      addSection("Comentario", [["Comentario", nomina.comentario]]);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const codigo = nomina.codigoNomina ?? String(nomina.id);
    const slugEmpleado = nombreEmpleado
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
    const filename = `detalle-nomina-${codigo}${
      slugEmpleado ? `-${slugEmpleado}` : ""
    }.xlsx`;

    return { buffer: Buffer.from(buffer), filename };
  }

  static async generarTablaDetallesNominasXlsx(
    empresaId: number,
    codigoNomina: string
  ): Promise<{ buffer: Buffer; filename: string }> {
    const nominas = await NominaRepository.findManyWithEmpleadoForPeriodo(
      empresaId,
      codigoNomina
    );
    if (nominas.length === 0) {
      throw new AppError(
        "No hay nóminas registradas para el período seleccionado",
        404
      );
    }

    const ordenadas = [...nominas].sort((a, b) => {
      const nombreA = `${a.empleado.nombre} ${a.empleado.apellido ?? ""}`.trim();
      const nombreB = `${b.empleado.nombre} ${b.empleado.apellido ?? ""}`.trim();
      return nombreA.localeCompare(nombreB, "es", { sensitivity: "base" });
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Detalles");
    const currencyFmt = '"L" #,##0.00';
    const headers = [
      "Colaborador",
      "Fecha de Corte",
      "Sueldo Quincenal",
      "Subtotal",
      "Total Horas Extra",
      "Ajustes",
      "Total Bruto",
      "Deducción IHSS",
      "Deducción ISR",
      "Deducción RAP",
      "Deducción Alimentación",
      "Deducción Alojamiento",
      "Préstamo",
      "Impuesto Vecinal",
      "Otros",
      "Total Deducciones",
      "Total a Pagar",
      "Estado",
    ];

    sheet.columns = headers.map((header, index) => ({
      header,
      width: index === 0 ? 32 : index === 1 ? 24 : 18,
    }));

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.alignment = { vertical: "middle", wrapText: true };

    const totals = {
      sueldoQuincenal: 0,
      subtotal: 0,
      horasExtra: 0,
      ajustes: 0,
      totalBruto: 0,
      totalDeducciones: 0,
      totalAPagar: 0,
    };

    ordenadas.forEach((n) => {
      const nombre = `${n.empleado.nombre} ${n.empleado.apellido ?? ""}`.trim();
      const sueldoQuincenal = this.round2((n.sueldoMensual ?? 0) / 2);
      const subtotal = n.subtotalQuincena ?? 0;
      const horasExtra = this.calcularTotalHorasExtra(n);
      const ajustes = n.ajuste ?? 0;
      const totalBruto = this.calcularTotalBruto(n);
      const totalDeducciones = this.calcularTotalDeducciones(n);
      const totalAPagar = this.calcularTotalAPagar(n);

      totals.sueldoQuincenal += sueldoQuincenal;
      totals.subtotal += subtotal;
      totals.horasExtra += horasExtra;
      totals.ajustes += ajustes;
      totals.totalBruto += totalBruto;
      totals.totalDeducciones += totalDeducciones;
      totals.totalAPagar += totalAPagar;

      const row = sheet.addRow([
        nombre,
        `${this.formatFechaUtc(n.fechaInicio)} - ${this.formatFechaUtc(n.fechaFin)}`,
        sueldoQuincenal,
        subtotal,
        horasExtra,
        ajustes,
        totalBruto,
        n.deduccionIHSS ?? 0,
        n.deduccionISR ?? 0,
        n.deduccionRAP ?? 0,
        n.deduccionAlimentacion ?? 0,
        n.deduccionAlojamiento ?? 0,
        n.cobroPrestamo ?? 0,
        n.impuestoVecinal ?? 0,
        n.otros ?? 0,
        totalDeducciones,
        totalAPagar,
        n.pagado ? "Pagado" : "Pendiente",
      ]);

      for (let col = 3; col <= 17; col++) {
        row.getCell(col).numFmt = currencyFmt;
      }
    });

    const totalRow = sheet.addRow([
      "Totales",
      "",
      this.round2(totals.sueldoQuincenal),
      this.round2(totals.subtotal),
      this.round2(totals.horasExtra),
      this.round2(totals.ajustes),
      this.round2(totals.totalBruto),
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      this.round2(totals.totalDeducciones),
      this.round2(totals.totalAPagar),
      "",
    ]);
    totalRow.font = { bold: true };
    for (const col of [3, 4, 5, 6, 7, 16, 17]) {
      totalRow.getCell(col).numFmt = currencyFmt;
    }

    sheet.views = [{ state: "frozen", ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `detalles-nominas-${codigoNomina}.xlsx`;
    return { buffer: Buffer.from(buffer), filename };
  }

  static async pagarPlanilla(
    empresaId: number,
    codigoNomina: string,
    updatedBy?: number | null
  ): Promise<{ actualizadas: number; total: number }> {
    const nominas = await NominaRepository.findMany({
      empresaId,
      codigoNomina,
    });
    if (nominas.length === 0) {
      throw new AppError(
        "No hay nóminas registradas para el período seleccionado",
        404
      );
    }

    const pendientes = nominas.filter((n) => !n.pagado);
    if (pendientes.length === 0) {
      throw new AppError("Todas las nóminas del período ya están pagadas", 400);
    }

    const actualizadas = await NominaRepository.marcarPagadasPorPeriodo(
      empresaId,
      codigoNomina,
      updatedBy
    );

    return { actualizadas, total: nominas.length };
  }
}
