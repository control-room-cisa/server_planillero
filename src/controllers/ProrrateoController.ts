// src/controllers/ProrrateoController.ts
import { RequestHandler } from "express";
import { ApiResponse } from "../dtos/ApiResponse";
import { AuthRequest } from "../middlewares/authMiddleware";
import { AppError } from "../errors/AppError";
import { ProrrateoService } from "../services/ProrrateoService";
import { guardarProrrateoSchema } from "../validators/prorrateo.validator";

export const guardarProrrateo: RequestHandler = async (req, res, next) => {
  try {
    const parsed = guardarProrrateoSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({
        field: i.path.join(".") || "body",
        message: i.message,
      }));
      return res.status(400).json({
        success: false,
        message: "Parámetros inválidos",
        data: null,
        errors,
      } satisfies ApiResponse<null>);
    }

    const authReq = req as AuthRequest;
    const result = await ProrrateoService.guardarDesdeNomina(
      parsed.data.nominaId,
      authReq.user.id,
      authReq.user.rolIds,
      parsed.data.asignacionesCompensatoriasTomadas ?? []
    );

    return res.status(201).json({
      success: true,
      message: "Prorrateo guardado exitosamente",
      data: result,
    } satisfies ApiResponse<typeof result>);
  } catch (err) {
    if (err instanceof AppError) return next(err);
    return next(err);
  }
};

export const estadoProrrateoPorNomina: RequestHandler = async (
  req,
  res,
  next
) => {
  try {
    const nominaId = Number(req.params.nominaId);
    if (!Number.isFinite(nominaId) || nominaId <= 0) {
      return res.status(400).json({
        success: false,
        message: "nominaId inválido",
        data: null,
      } satisfies ApiResponse<null>);
    }

    const authReq = req as AuthRequest;
    const data = await ProrrateoService.existePorNomina(
      nominaId,
      authReq.user.id,
      authReq.user.rolIds
    );
    return res.json({
      success: true,
      message: "Estado de prorrateo obtenido",
      data,
    } satisfies ApiResponse<typeof data>);
  } catch (err) {
    if (err instanceof AppError) return next(err);
    return next(err);
  }
};
