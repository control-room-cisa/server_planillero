// src/services/NominaService.ts
import type { Nomina } from "@prisma/client";
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
    const empleadoConDepto = await EmpleadoRepository.findById(
      payload.empleadoId
    );
    // obtener empresaId vía prisma directamente para evitar múltiples consultas
    const depto = await (async () => {
      return await (
        await import("../config/prisma")
      ).prisma.departamento.findFirst({
        where: { id: empleado.departamentoId },
        select: { empresaId: true },
      });
    })();
    const empresaId = depto?.empresaId;
    if (!empresaId) {
      throw new AppError("No se pudo resolver la empresa del empleado", 400);
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
      diasIncapacidad: payload.diasIncapacidad ?? null,
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

    // Prisma ignora automáticamente los campos undefined en las actualizaciones
    return NominaRepository.update(id, {
      ...payload,
      ...(updatedBy
        ? { updatedByEmpleado: { connect: { id: updatedBy } } }
        : {}),
      // Relaciones opcionales requieren sintaxis especial de Prisma
      ...(payload.empleadoId
        ? { empleado: { connect: { id: payload.empleadoId } } }
        : {}),
    });
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

    // Eliminación lógica con auditoría
    return NominaRepository.delete(id, deletedBy);
  }
}
