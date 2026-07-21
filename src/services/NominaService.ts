// src/services/NominaService.ts
import type { Nomina } from "@prisma/client";
import ExcelJS from "exceljs";
import { NominaRepository } from "../repositories/NominaRepository";
import type {
  CrearNominaDto,
  ActualizarNominaDto,
} from "../validators/nomina.validator";
import { AppError } from "../errors/AppError";
import { EmpleadoRepository } from "../repositories/EmpleadoRepository";
import { RegistroDiarioService } from "./RegistroDiarioService";

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
   * Ajusta saldos acumulados en Empleado:
   * - tiempoCompensatorioHoras: suma deltaComp
   * - tiempoVacacionesHoras:    suma deltaVacHoras (negativo para descontar)
   */
  private static async ajustarSaldosEmpleado(
    empleadoId: number,
    deltaComp: number,
    deltaVacHoras: number
  ): Promise<void> {
    const dComp = Number(deltaComp || 0);
    const dVac = Number(deltaVacHoras || 0);
    if (dComp === 0 && dVac === 0) return;

    const empleado = await EmpleadoRepository.findById(empleadoId);
    if (!empleado) return;

    const compActual = empleado.tiempoCompensatorioHoras ?? 0;
    const vacActual = empleado.tiempoVacacionesHoras ?? 0;

    await EmpleadoRepository.updateEmpleado(empleadoId, {
      tiempoCompensatorioHoras: compActual + dComp,
      tiempoVacacionesHoras: vacActual + dVac,
    });
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
    const camposOpcionales = {
      diasLaborados: payload.diasLaborados ?? null,
      diasVacaciones: payload.diasVacaciones ?? null,
      diasIncapacidadEmpresa: payload.diasIncapacidadEmpresa ?? null,
      diasIncapacidadIHSS: payload.diasIncapacidadIHSS ?? null,
      horasCompensatorias: payload.horasCompensatorias ?? null,
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

    const created = await NominaRepository.create({
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
    });

    // Ajustar acumulados en Empleado al crear nómina:
    // - Compensatorio: sumar horas de la nómina
    // - Vacaciones: descontar horas (diasVacaciones * 8)
    const compAplicado = Number(payload.horasCompensatorias ?? 0);
    const vacHorasAplicadas = this.horasVacacionesFromDias(payload.diasVacaciones);
    await this.ajustarSaldosEmpleado(
      payload.empleadoId,
      compAplicado,
      -vacHorasAplicadas
    );

    // Actualizar aprobacionRrhh a true para todos los registros diarios
    // del empleado en el rango de fechas de la nómina
    try {
      // Convertir fechas a formato "YYYY-MM-DD" para el filtro de registros diarios
      const fechaInicioStr =
        payload.fechaInicio instanceof Date
          ? payload.fechaInicio.toISOString().split("T")[0]
          : String(payload.fechaInicio).split("T")[0];
      const fechaFinStr =
        payload.fechaFin instanceof Date
          ? payload.fechaFin.toISOString().split("T")[0]
          : String(payload.fechaFin).split("T")[0];

      await RegistroDiarioService.aprobarRrhhByDateRange(
        payload.empleadoId,
        fechaInicioStr,
        fechaFinStr,
        undefined // Ya no usamos código, solo ID
      );
    } catch (error) {
      // Si falla la actualización de registros, loguear el error pero no fallar la creación de la nómina
      console.error(
        "Error al actualizar aprobación RRHH en registros diarios:",
        error
      );
      // Podrías optar por hacer rollback de la nómina si es crítico, pero por ahora solo logueamos
    }

    return created;
  }

  static async update(
    id: number,
    payload: ActualizarNominaDto,
    updatedBy?: number | null
  ): Promise<Nomina> {
    const existing = await NominaRepository.findById(id);
    if (!existing) throw new AppError("Nómina no encontrada", 404);

    const { empleadoId: empleadoIdPayload, ...restPayload } = payload;

    // Validar solapamientos si se están actualizando las fechas o el empleado
    const empleadoId = empleadoIdPayload ?? existing.empleadoId;
    const fechaInicio = payload.fechaInicio
      ? payload.fechaInicio instanceof Date
        ? payload.fechaInicio
        : new Date(payload.fechaInicio)
      : existing.fechaInicio instanceof Date
      ? existing.fechaInicio
      : new Date(existing.fechaInicio);
    const fechaFin = payload.fechaFin
      ? payload.fechaFin instanceof Date
        ? payload.fechaFin
        : new Date(payload.fechaFin)
      : existing.fechaFin instanceof Date
      ? existing.fechaFin
      : new Date(existing.fechaFin);

    // Solo validar si se están cambiando fechas o empleado
    if (
      payload.fechaInicio ||
      payload.fechaFin ||
      (empleadoIdPayload && empleadoIdPayload !== existing.empleadoId)
    ) {
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
        id // Excluir la nómina actual
      );
      if (overlapping.length > 0) {
        throw new AppError(
          "Ya existe una nómina activa que traslapa con el período seleccionado",
          400
        );
      }
    }

    // Prisma no acepta empleadoId como escalar en update; usar connect en la relación
    const codigoNominaUpdate =
      payload.fechaInicio || payload.fechaFin
        ? generarCodigoNomina(fechaInicio, fechaFin)
        : undefined;

    // horasCompensatorias es inmutable en actualización (solo se fija al crear).
    const updated = await NominaRepository.update(id, {
      ...restPayload,
      ...(codigoNominaUpdate ? { codigoNomina: codigoNominaUpdate } : {}),
      ...(updatedBy
        ? { updatedByEmpleado: { connect: { id: updatedBy } } }
        : {}),
      ...(empleadoIdPayload
        ? { empleado: { connect: { id: empleadoIdPayload } } }
        : {}),
    });

    // Recalcular saldos de vacaciones si cambian. Compensatorias no se tocan en update.
    const oldEmpleadoId = existing.empleadoId;
    const newEmpleadoId = empleadoIdPayload ?? existing.empleadoId;
    const compFijo = Number(existing.horasCompensatorias ?? 0);

    const oldVacHoras = this.horasVacacionesFromDias(existing.diasVacaciones);
    const newVacHoras = this.horasVacacionesFromDias(
      payload.diasVacaciones ?? existing.diasVacaciones
    );

    if (oldEmpleadoId === newEmpleadoId) {
      const deltaVac = oldVacHoras - newVacHoras;
      await this.ajustarSaldosEmpleado(newEmpleadoId, 0, deltaVac);
    } else {
      await this.ajustarSaldosEmpleado(oldEmpleadoId, -compFijo, oldVacHoras);
      await this.ajustarSaldosEmpleado(newEmpleadoId, compFijo, -newVacHoras);
    }

    return updated;
  }

  static async delete(id: number, deletedBy?: number | null): Promise<Nomina> {
    const existing = await NominaRepository.findById(id);
    if (!existing) throw new AppError("Nómina no encontrada", 404);

    // Validar que la nómina no esté pagada
    if (existing.pagado) {
      throw new AppError(
        "No se puede eliminar una nómina que ya ha sido pagada",
        400
      );
    }

    // Revertir aprobacionRrhh a null para todos los registros diarios
    // del empleado en el rango de fechas de la nómina
    try {
      // Convertir fechas a formato "YYYY-MM-DD" para el filtro de registros diarios
      const fechaInicioStr =
        existing.fechaInicio instanceof Date
          ? existing.fechaInicio.toISOString().split("T")[0]
          : String(existing.fechaInicio).split("T")[0];
      const fechaFinStr =
        existing.fechaFin instanceof Date
          ? existing.fechaFin.toISOString().split("T")[0]
          : String(existing.fechaFin).split("T")[0];

      await RegistroDiarioService.revertirRrhhApprovalByDateRange(
        existing.empleadoId,
        fechaInicioStr,
        fechaFinStr
      );
    } catch (error) {
      // Si falla la actualización de registros, loguear el error pero no fallar la eliminación de la nómina
      console.error(
        "Error al revertir aprobación RRHH en registros diarios:",
        error
      );
    }

    // Eliminar lógicamente la nómina
    const deleted = await NominaRepository.delete(id, deletedBy);

    // Revertir el efecto que tuvo la creación de esta nómina en saldos del empleado
    const compAplicado = Number(existing.horasCompensatorias ?? 0);
    const vacHorasAplicadas = this.horasVacacionesFromDias(existing.diasVacaciones);
    await this.ajustarSaldosEmpleado(
      existing.empleadoId,
      -compAplicado,
      vacHorasAplicadas
    );

    return deleted;
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

  private static calcularTotalAPagar(nomina: Nomina): number {
    return (
      Math.round(
        (this.calcularTotalBruto(nomina) -
          this.calcularTotalDeducciones(nomina)) *
          100
      ) / 100
    );
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
