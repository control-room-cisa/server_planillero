import { RequestHandler } from "express";
import { ApiResponse } from "../dtos/ApiResponse";
import type {
  CalendarioDiaDto,
  CalendarioOcupacionDto,
  PaginatedDto,
  SolicitudPermisoDiaDto,
  SolicitudPermisoDto,
} from "../dtos/solicitudPermiso.dto";
import { AuthRequest } from "../middlewares/authMiddleware";
import { SolicitudPermisoService } from "../services/SolicitudPermisoService";
import {
  calendarioDiaSchema,
  calendarioSchema,
  createSolicitudPermisoSchema,
  decisionSolicitudSchema,
  listDiasSchema,
  listPropiasSchema,
  listRrhhSchema,
  listSupervisionSchema,
  solicitudIdParamsSchema,
  updateSolicitudPermisoSchema,
} from "../validators/solicitudPermiso.validator";

function userOf(req: Parameters<RequestHandler>[0]) {
  return (req as AuthRequest).user;
}

export const listPropias: RequestHandler<
  {},
  ApiResponse<PaginatedDto<SolicitudPermisoDto>>
> = async (req, res, next) => {
  try {
    const { page, limit } = listPropiasSchema.parse({ query: req.query }).query;
    const data = await SolicitudPermisoService.listPropias(
      userOf(req).id,
      page,
      limit
    );
    return res.json({
      success: true,
      message: "Solicitudes del colaborador",
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const createPropia: RequestHandler<
  {},
  ApiResponse<SolicitudPermisoDto>
> = async (req, res, next) => {
  try {
    const body = createSolicitudPermisoSchema.parse({ body: req.body }).body;
    const data = await SolicitudPermisoService.create(userOf(req).id, body);
    return res.status(201).json({
      success: true,
      message: "Solicitud creada",
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const getPropia: RequestHandler<
  { id: string },
  ApiResponse<SolicitudPermisoDto>
> = async (req, res, next) => {
  try {
    const { id } = solicitudIdParamsSchema.parse({ params: req.params }).params;
    const data = await SolicitudPermisoService.getForEmpleado(
      userOf(req).id,
      Number(id)
    );
    return res.json({ success: true, message: "Solicitud", data });
  } catch (err) {
    next(err);
  }
};

export const updatePropia: RequestHandler<
  { id: string },
  ApiResponse<SolicitudPermisoDto>
> = async (req, res, next) => {
  try {
    const parsed = updateSolicitudPermisoSchema.parse({
      params: req.params,
      body: req.body,
    });
    const data = await SolicitudPermisoService.update(
      userOf(req).id,
      Number(parsed.params.id),
      parsed.body
    );
    return res.json({
      success: true,
      message: "Solicitud actualizada",
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const deletePropia: RequestHandler<
  { id: string },
  ApiResponse<null>
> = async (req, res, next) => {
  try {
    const { id } = solicitudIdParamsSchema.parse({ params: req.params }).params;
    await SolicitudPermisoService.remove(userOf(req).id, Number(id));
    return res.json({
      success: true,
      message: "Solicitud eliminada",
      data: null,
    });
  } catch (err) {
    next(err);
  }
};

export const listDiasPropios: RequestHandler<
  { id: string },
  ApiResponse<PaginatedDto<SolicitudPermisoDiaDto>>
> = async (req, res, next) => {
  try {
    const parsed = listDiasSchema.parse({
      params: req.params,
      query: req.query,
    });
    const user = userOf(req);
    const data = await SolicitudPermisoService.listDias(
      { id: user.id, departamentoId: user.departamentoId, rol: "empleado" },
      Number(parsed.params.id),
      parsed.query.page,
      parsed.query.limit
    );
    return res.json({ success: true, message: "Días solicitados", data });
  } catch (err) {
    next(err);
  }
};

export const listSupervision: RequestHandler<
  {},
  ApiResponse<PaginatedDto<SolicitudPermisoDto>>
> = async (req, res, next) => {
  try {
    const { page, limit } = listSupervisionSchema.parse({
      query: req.query,
    }).query;
    const user = userOf(req);
    const data = await SolicitudPermisoService.listSupervision(
      user.id,
      user.departamentoId,
      page,
      limit
    );
    return res.json({
      success: true,
      message: "Solicitudes del equipo",
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const pendientesSupervision: RequestHandler<
  {},
  ApiResponse<{ count: number }>
> = async (req, res, next) => {
  try {
    const user = userOf(req);
    const count = await SolicitudPermisoService.pendientesSupervision(
      user.id,
      user.departamentoId
    );
    return res.json({
      success: true,
      message: "Solicitudes pendientes de supervisor",
      data: { count },
    });
  } catch (err) {
    next(err);
  }
};

export const calendarioSupervision: RequestHandler<
  {},
  ApiResponse<CalendarioDiaDto[]>
> = async (req, res, next) => {
  try {
    const { desde, hasta } = calendarioSchema.parse({ query: req.query }).query;
    const user = userOf(req);
    const data = await SolicitudPermisoService.calendario(
      user.id,
      user.departamentoId,
      desde,
      hasta
    );
    return res.json({
      success: true,
      message: "Calendario de solicitudes",
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const ocupacionDiaSupervision: RequestHandler<
  {},
  ApiResponse<PaginatedDto<CalendarioOcupacionDto>>
> = async (req, res, next) => {
  try {
    const query = calendarioDiaSchema.parse({ query: req.query }).query;
    const user = userOf(req);
    const data = await SolicitudPermisoService.ocupacionDia(
      user.id,
      user.departamentoId,
      query.fecha,
      query.page,
      query.limit
    );
    return res.json({
      success: true,
      message: "Personas en el día",
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const getSupervision: RequestHandler<
  { id: string },
  ApiResponse<SolicitudPermisoDto>
> = async (req, res, next) => {
  try {
    const { id } = solicitudIdParamsSchema.parse({ params: req.params }).params;
    const user = userOf(req);
    const data = await SolicitudPermisoService.getForSupervisor(
      user.id,
      user.departamentoId,
      Number(id)
    );
    return res.json({ success: true, message: "Solicitud", data });
  } catch (err) {
    next(err);
  }
};

export const listDiasSupervision: RequestHandler<
  { id: string },
  ApiResponse<PaginatedDto<SolicitudPermisoDiaDto>>
> = async (req, res, next) => {
  try {
    const parsed = listDiasSchema.parse({
      params: req.params,
      query: req.query,
    });
    const user = userOf(req);
    const data = await SolicitudPermisoService.listDias(
      { id: user.id, departamentoId: user.departamentoId, rol: "supervisor" },
      Number(parsed.params.id),
      parsed.query.page,
      parsed.query.limit
    );
    return res.json({ success: true, message: "Días solicitados", data });
  } catch (err) {
    next(err);
  }
};

export const decidirSupervision: RequestHandler<
  { id: string },
  ApiResponse<SolicitudPermisoDto>
> = async (req, res, next) => {
  try {
    const parsed = decisionSolicitudSchema.parse({
      params: req.params,
      body: req.body,
    });
    const user = userOf(req);
    const data = await SolicitudPermisoService.decidirSupervisor(
      user.id,
      user.departamentoId,
      Number(parsed.params.id),
      parsed.body
    );
    return res.json({
      success: true,
      message: parsed.body.aprobado
        ? "Solicitud aprobada por supervisión"
        : "Solicitud rechazada por supervisión",
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const listRrhh: RequestHandler<
  {},
  ApiResponse<PaginatedDto<SolicitudPermisoDto>>
> = async (req, res, next) => {
  try {
    const query = listRrhhSchema.parse({ query: req.query }).query;
    const data = await SolicitudPermisoService.listRrhh(
      query.empresaId,
      query.page,
      query.limit
    );
    return res.json({
      success: true,
      message: "Solicitudes aprobadas por supervisión",
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const pendientesRrhh: RequestHandler<
  {},
  ApiResponse<{ count: number }>
> = async (req, res, next) => {
  try {
    const count = await SolicitudPermisoService.pendientesRrhh(userOf(req).id);
    return res.json({
      success: true,
      message: "Solicitudes pendientes de RRHH",
      data: { count },
    });
  } catch (err) {
    next(err);
  }
};

export const getRrhh: RequestHandler<
  { id: string },
  ApiResponse<SolicitudPermisoDto>
> = async (req, res, next) => {
  try {
    const { id } = solicitudIdParamsSchema.parse({ params: req.params }).params;
    const data = await SolicitudPermisoService.getForRrhh(Number(id));
    return res.json({ success: true, message: "Solicitud", data });
  } catch (err) {
    next(err);
  }
};

export const listDiasRrhh: RequestHandler<
  { id: string },
  ApiResponse<PaginatedDto<SolicitudPermisoDiaDto>>
> = async (req, res, next) => {
  try {
    const parsed = listDiasSchema.parse({
      params: req.params,
      query: req.query,
    });
    const user = userOf(req);
    const data = await SolicitudPermisoService.listDias(
      { id: user.id, departamentoId: user.departamentoId, rol: "rrhh" },
      Number(parsed.params.id),
      parsed.query.page,
      parsed.query.limit
    );
    return res.json({ success: true, message: "Días solicitados", data });
  } catch (err) {
    next(err);
  }
};

export const decidirRrhh: RequestHandler<
  { id: string },
  ApiResponse<SolicitudPermisoDto>
> = async (req, res, next) => {
  try {
    const parsed = decisionSolicitudSchema.parse({
      params: req.params,
      body: req.body,
    });
    const data = await SolicitudPermisoService.decidirRrhh(
      userOf(req).id,
      Number(parsed.params.id),
      parsed.body
    );
    return res.json({
      success: true,
      message: parsed.body.aprobado
        ? "Solicitud aprobada por RRHH"
        : "Solicitud rechazada por RRHH",
      data,
    });
  } catch (err) {
    next(err);
  }
};
