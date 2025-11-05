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
  }): Promise<Nomina[]> {
    return NominaRepository.findMany(params);
  }

  static async create(
    payload: CrearNominaDto,
    codigoEmpleadoCreacion?: string | null
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

    // Prisma types: map DTO to create input
    const created = await NominaRepository.create({
      empleado: { connect: { id: payload.empleadoId } },
      empresa: { connect: { id: empresaId } },
      nombrePeriodoNomina: payload.nombrePeriodoNomina ?? null,
      fechaInicio: payload.fechaInicio,
      fechaFin: payload.fechaFin,
      sueldoMensual: payload.sueldoMensual,

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
      codigoEmpleadoCreacion: codigoEmpleadoCreacion ?? null,
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
        codigoEmpleadoCreacion ?? undefined
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
    payload: ActualizarNominaDto
  ): Promise<Nomina> {
    const existing = await NominaRepository.findById(id);
    if (!existing) throw new AppError("Nómina no encontrada", 404);

    // Prisma ignora automáticamente los campos undefined en las actualizaciones
    return NominaRepository.update(id, {
      ...payload,
      // Relaciones opcionales requieren sintaxis especial de Prisma
      ...(payload.empleadoId
        ? { empleado: { connect: { id: payload.empleadoId } } }
        : {}),
    });
  }
}
