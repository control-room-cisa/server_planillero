import { RequestHandler } from "express";
import { PlanillaService } from "../services/PlanillaService";
import { ApiResponse } from "../dtos/ApiResponse";
import type { CreatePlanillaDto, PlanillaResponse } from "../dtos/planilla.dto";
import type { PlanillaDetailResponse } from "../dtos/planilla.dto";
import { prisma } from "../config/prisma";
import { AuthRequest } from "../middlewares/authMiddleware";

// POST /planillas
export const createPlanilla: RequestHandler<
  {},
  ApiResponse<PlanillaDetailResponse>,
  CreatePlanillaDto,
  {}
> = async (req, res, next) => {
  try {
    const empleadoId = (req as AuthRequest).user.id;
    const { fechaInicio, fechaFin } = req.body;

    console.log(req);

    console.log("EmpleadoID:", empleadoId);

    const planilla = await PlanillaService.create({
      empleadoId,
      fechaInicio,
      fechaFin,
    });

    return res.status(201).json({
      success: true,
      message: "Planilla creada con detalle",
      data: planilla as PlanillaDetailResponse,
    });
  } catch (err) {
    next(err);
  }
};

// GET /planillas/last -> última planilla de cada empleado (sin detalle)
export const getAllLatestPlanillas: RequestHandler<
  {},
  ApiResponse<PlanillaResponse[]>,
  {},
  {}
> = async (_req, res, next) => {
  try {
    const planillas = await PlanillaService.getAllLast();
    return res.json({
      success: true,
      message: "Última planilla de cada empleado",
      data: planillas as PlanillaResponse[],
    });
  } catch (err) {
    next(err);
  }
};

export const getPlanillaDepartamentoDetalle: RequestHandler<
  { empleadoId: string }, // params
  ApiResponse<any>, // response
  {}, // body
  { start?: string; end?: string } // query
> = async (req, res, next) => {
  try {
    const user = (req as AuthRequest).user;

    if (user.rolId !== 2) {
      return res.status(403).json({
        success: false,
        message: "Solo supervisores",
        data: null,
      });
    }

    const { empleadoId } = req.params;
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({
        success: false,
        message: "Parámetros start y end obligatorios (YYYY-MM-DD)",
        data: null,
      });
    }

    // Validar que ese empleado pertenece a su departamento
    const empleado = await prisma.empleado.findFirst({
      where: {
        id: Number(empleadoId),
        departamentoId: user.departamentoId,
        deletedAt: null,
      },
    });

    if (!empleado) {
      return res.status(404).json({
        success: false,
        message: "Empleado no encontrado o no pertenece a tu departamento",
        data: null,
      });
    }

    const data = await PlanillaService.getPlanillaDetalleRango(
      Number(empleadoId),
      start,
      end
    );

    res.json({
      success: true,
      message: "Planillas del empleado",
      data,
    });
  } catch (err) {
    next(err);
  }
};
