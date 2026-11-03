import { RequestHandler } from "express";
import { ApiResponse } from "../dtos/ApiResponse";
import type {
  NotificacionLogDto,
  PaginatedDto,
} from "../dtos/notificacionLog.dto";
import { AuthRequest } from "../middlewares/authMiddleware";
import { NotificacionLogService } from "../services/NotificacionLogService";
import {
  listNotificacionesSchema,
  notificacionIdParamsSchema,
} from "../validators/notificacionLog.validator";

function userOf(req: Parameters<RequestHandler>[0]) {
  return (req as AuthRequest).user;
}

export const listMias: RequestHandler<
  {},
  ApiResponse<PaginatedDto<NotificacionLogDto>>
> = async (req, res, next) => {
  try {
    const query = listNotificacionesSchema.parse({ query: req.query }).query;
    const data = await NotificacionLogService.listMias(
      userOf(req).id,
      query.page,
      query.limit,
      {
        soloNoLeidas: query.soloNoLeidas,
        categoria: query.categoria,
      }
    );
    return res.json({
      success: true,
      message: "Notificaciones",
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const marcarLeida: RequestHandler<
  { id: string },
  ApiResponse<NotificacionLogDto>
> = async (req, res, next) => {
  try {
    const { id } = notificacionIdParamsSchema.parse({
      params: req.params,
    }).params;
    const data = await NotificacionLogService.marcarLeida(
      userOf(req).id,
      Number(id)
    );
    return res.json({
      success: true,
      message: "Notificación marcada como leída",
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const countNoLeidas: RequestHandler<
  {},
  ApiResponse<{ count: number }>
> = async (req, res, next) => {
  try {
    const count = await NotificacionLogService.countNoLeidas(userOf(req).id);
    return res.json({
      success: true,
      message: "Notificaciones no leídas",
      data: { count },
    });
  } catch (err) {
    next(err);
  }
};
