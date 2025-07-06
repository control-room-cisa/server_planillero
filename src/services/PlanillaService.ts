// src/services/PlanillaService.ts
import { prisma } from "../config/prisma";
import { AppError } from "../errors/AppError";
import { PlanillaRepository } from "../repositories/PlanillaRepository";
import type { Planilla } from "@prisma/client";

/**
 * Parámetros internos para crear una planilla
 */
interface CreatePlanillaParams {
  empleadoId:  number;
  fechaInicio: Date;
  fechaFin:    Date;
}

export class PlanillaService {
  /**
   * Crea una nueva planilla para un empleado, validando traslapes
   */
  static async create(data: CreatePlanillaParams): Promise<Planilla> {
    // 1) Verificar overlap
    const overlaps = await PlanillaRepository.findOverlapping(
      data.empleadoId,
      data.fechaInicio,
      data.fechaFin
    );
    if (overlaps.length > 0) {
      throw new AppError(
        "El rango de fechas se traslapa con una planilla existente",
        400
      );
    }

    // 2) Obtener empresa a través del departamento del empleado
    const empleado = await prisma.empleado.findFirst({
      where: {
        id:        data.empleadoId,
        deletedAt: null,            // aquí filtras “no borrado”
      },
      include: { departamento: true }
    });
    if (!empleado) {
      throw new AppError("Empleado no encontrado", 404);
    }


    // 3) Crear la planilla
    return PlanillaRepository.createPlanilla({
      empleadoId:  data.empleadoId,
      empresaId:   empleado.departamento.empresaId,
      fechaInicio: data.fechaInicio,
      fechaFin:    data.fechaFin,
    });
  }

  /**
   * Devuelve la última planilla de **cada** empleado (sin detalle de días)
   */
  static async getAllLast(): Promise<Planilla[]> {
    return PlanillaRepository.findLastByEmpleado();
  }

  /**
   * Devuelve la **última** planilla del empleado indicado, con TODOS los detalles anidados
   */
  static async getDetailById(planillaId: number): Promise<Planilla> {
    const detalles = await PlanillaRepository.findByIdWithDetails (
      planillaId
    );
    if (!detalles) {
      throw new AppError("No se encontró ninguna planilla para este empleado", 404);
    }
    return detalles;
  }
}
