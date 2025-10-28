// src/services/NominaService.ts
import type { Nomina } from "@prisma/client";
import { NominaRepository } from "../repositories/NominaRepository";
import type {
  CrearNominaDto,
  ActualizarNominaDto,
} from "../validators/nomina.validator";
import { AppError } from "../errors/AppError";
import { EmpleadoRepository } from "../repositories/EmpleadoRepository";

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
    return NominaRepository.create({
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
  }

  static async update(
    id: number,
    payload: ActualizarNominaDto
  ): Promise<Nomina> {
    const existing = await NominaRepository.findById(id);
    if (!existing) throw new AppError("Nómina no encontrada", 404);

    return NominaRepository.update(id, {
      // Relaciones opcionales
      ...(payload.empleadoId
        ? { empleado: { connect: { id: payload.empleadoId } } }
        : {}),
      ...(payload.empresaId
        ? { empresa: { connect: { id: payload.empresaId } } }
        : {}),
      nombrePeriodoNomina:
        payload.nombrePeriodoNomina ?? existing.nombrePeriodoNomina,
      fechaInicio: payload.fechaInicio ?? existing.fechaInicio,
      fechaFin: payload.fechaFin ?? existing.fechaFin,
      sueldoMensual: payload.sueldoMensual ?? existing.sueldoMensual,

      diasLaborados: payload.diasLaborados ?? existing.diasLaborados,
      diasVacaciones: payload.diasVacaciones ?? existing.diasVacaciones,
      diasIncapacidad: payload.diasIncapacidad ?? existing.diasIncapacidad,

      subtotalQuincena: payload.subtotalQuincena ?? existing.subtotalQuincena,
      montoVacaciones: payload.montoVacaciones ?? existing.montoVacaciones,
      montoDiasLaborados:
        payload.montoDiasLaborados ?? existing.montoDiasLaborados,
      montoExcedenteIHSS:
        payload.montoExcedenteIHSS ?? existing.montoExcedenteIHSS,
      montoIncapacidadCubreEmpresa:
        payload.montoIncapacidadCubreEmpresa ??
        existing.montoIncapacidadCubreEmpresa,
      montoPermisosJustificados:
        payload.montoPermisosJustificados ?? existing.montoPermisosJustificados,

      montoHoras25: payload.montoHoras25 ?? existing.montoHoras25,
      montoHoras50: payload.montoHoras50 ?? existing.montoHoras50,
      montoHoras75: payload.montoHoras75 ?? existing.montoHoras75,
      montoHoras100: payload.montoHoras100 ?? existing.montoHoras100,

      ajuste: payload.ajuste ?? existing.ajuste,
      totalPercepciones:
        payload.totalPercepciones ?? existing.totalPercepciones,
      deduccionIHSS: payload.deduccionIHSS ?? existing.deduccionIHSS,
      deduccionISR: payload.deduccionISR ?? existing.deduccionISR,
      deduccionRAP: payload.deduccionRAP ?? existing.deduccionRAP,
      deduccionAlimentacion:
        payload.deduccionAlimentacion ?? existing.deduccionAlimentacion,
      cobroPrestamo: payload.cobroPrestamo ?? existing.cobroPrestamo,
      impuestoVecinal: payload.impuestoVecinal ?? existing.impuestoVecinal,
      otros: payload.otros ?? existing.otros,
      totalDeducciones: payload.totalDeducciones ?? existing.totalDeducciones,
      totalNetoPagar: payload.totalNetoPagar ?? existing.totalNetoPagar,
    });
  }
}
