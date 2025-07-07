// src/controllers/RegistroDiarioController.ts
import { RequestHandler } from "express";
import { RegistroDiarioService } from "../services/RegistroDiarioService";
import { ApiResponse }           from "../dtos/ApiResponse";
import { AuthRequest }           from "../middlewares/authMiddleware";
import type {
  RegistroDiarioDetail,
  UpsertRegistroDiarioParams
} from "../repositories/RegistroDiarioRepository";

/** POST /registros */
export const upsertRegistroDiario: RequestHandler<
  {}, ApiResponse<RegistroDiarioDetail>, Omit<UpsertRegistroDiarioParams, "empleadoId">, {}
> = async (req, res, next) => {
  try {
    const empleadoId = (req as AuthRequest).user.id;
    const registro = await RegistroDiarioService.upsertRegistro(empleadoId, req.body);
    res.json({ success: true, message: "Guardado", data: registro });
  } catch (err) {
    next(err);
  }
};

/** GET /registros?date=YYYY-MM-DD */
export const getRegistroDiarioByDate: RequestHandler<
  {}, ApiResponse<RegistroDiarioDetail | null>, {}, { date?: string }
> = async (req, res, next) => {
  try {
    const empleadoId = (req as AuthRequest).user.id;
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, message: "date requerido", data: null });
    }
    const registro = await RegistroDiarioService.getByDate(empleadoId, new Date(date as string));
    res.json({
      success: true,
      message: registro ? "Encontrado" : "No existe",
      data: registro
    });
  } catch (err) {
    next(err);
  }
};
