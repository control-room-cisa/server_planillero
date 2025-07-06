import { RequestHandler } from "express";
import { PlanillaService } from "../services/PlanillaService";
import { ApiResponse }      from "../dtos/ApiResponse";
import type { CreatePlanillaDto, PlanillaResponse } from "../dtos/planilla/planillaDtos";
import type { PlanillaDetailResponse } from "../dtos/planilla/planillaDtos";
import { AuthRequest }      from "../middlewares/authMiddleware";

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
    
    console.log("EmpleadoID:",empleadoId);
    
    const planilla = await PlanillaService.create({ empleadoId, fechaInicio, fechaFin });

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

// GET /planillas/last-detail -> última planilla del empleado autenticado con detalle
export const getLatestPlanillaDetail: RequestHandler<
  {},
  ApiResponse<PlanillaDetailResponse>,
  {},
  {}
> = async (req, res, next) => {
  try {
    const empleadoId = (req as AuthRequest).user.id;
    const planilla = await PlanillaService.getDetailById(empleadoId);

    return res.json({
      success: true,
      message: "Planilla con detalle",
      data: planilla as PlanillaDetailResponse,
    });
  } catch (err) {
    next(err);
  }
};


