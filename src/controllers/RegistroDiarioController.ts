// src/controllers/RegistroDiarioController.ts
import { RequestHandler } from "express";
import { RegistroDiarioService } from "../services/RegistroDiarioService";
import { ApiResponse }           from "../dtos/ApiResponse";
import { AuthRequest }           from "../middlewares/authMiddleware";
import type {
  RegistroDiarioDetail,
  UpsertRegistroDiarioParams
} from "../repositories/RegistroDiarioRepository";

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * POST /api/registrodiario
 * Crea o actualiza un registro diario + actividades.
 * Valida que `fecha` sea un string ISO date (YYYY-MM-DD).
 */
export const upsertRegistroDiario: RequestHandler<
  {},
  ApiResponse<RegistroDiarioDetail>,
  Omit<UpsertRegistroDiarioParams, "empleadoId">,
  {}
> = async (req, res, next) => {
  try {
    const empleadoId = (req as AuthRequest).user.id;
    const { fecha } = req.body;

    // Validación sencilla de fecha ISO
    if (typeof fecha !== "string" || !ISO_DATE_REGEX.test(fecha) || isNaN(Date.parse(fecha))) {
      return res.status(400).json({
        success: false,
        message: "El campo 'fecha' debe ser un string ISO (YYYY-MM-DD)",
        data: null
      });
    }

    const registro = await RegistroDiarioService.upsertRegistro(empleadoId, req.body);
    return res.status(201).json({
      success: true,
      message: "Registro diario guardado",
      data: registro
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/registrodiario?fecha=YYYY-MM-DD
 * Recupera un registro diario por fecha (con actividades → job).
 * Valida `fecha` como ISO date string.
 */
export const getRegistroDiarioByDate: RequestHandler<
  {},
  ApiResponse<RegistroDiarioDetail | null>,
  {},
  { fecha?: string }
> = async (req, res, next) => {
  try {
    const empleadoId = (req as AuthRequest).user.id;
    const { fecha } = req.query;

    if (typeof fecha !== "string" || !ISO_DATE_REGEX.test(fecha) || isNaN(Date.parse(fecha))) {
      return res.status(400).json({
        success: false,
        message: "El query param 'fecha' debe ser un string ISO (YYYY-MM-DD)",
        data: null
      });
    }

    const registro = await RegistroDiarioService.getByDate(empleadoId, fecha);
    return res.json({
      success: true,
      message: registro ? "Registro encontrado" : "No existe registro para esa fecha",
      data: registro
    });
  } catch (err) {
    next(err);
  }
};
