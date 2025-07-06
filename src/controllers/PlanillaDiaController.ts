import { RequestHandler } from "express";
import { PlanillaDiaService } from "../services/PlanillaDiaService";
import { ApiResponse }       from "../dtos/ApiResponse";
import type {
  UpsertDiaWithActivitiesParams,
  PlanillaDiaDetail
} from "../repositories/PlanillaDiaRepository";
import { AuthRequest }       from "../middlewares/authMiddleware";

export const upsertPlanillaDia: RequestHandler<
  {},                                                // params
  ApiResponse<PlanillaDiaDetail>,                    // res body
  Omit<UpsertDiaWithActivitiesParams, "empleadoId">, // req body
  {}                                                 // query
> = async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const empleadoId = authReq.user.id;

    // body debe traer todas las demás props, incluyendo registroDate
    const body = req.body as Omit<UpsertDiaWithActivitiesParams, "empleadoId">;

    const dia = await PlanillaDiaService.upsertDia({
      ...body,
      empleadoId,
    });

    return res.json({
      success: true,
      message: "Registro diario guardado",
      data: dia as PlanillaDiaDetail,
    });
  } catch (err) {
    next(err);
  }
};
