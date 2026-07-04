import { RequestHandler } from "express";
import { ApiResponse } from "../dtos/ApiResponse";
import { TechoIhssService } from "../services/TechoIhssService";
import {
  techoIhssCreateSchema,
  techoIhssUpdateSchema,
} from "../validators/techoIhss.validator";

type TechoIhssRow = {
  id: number;
  createdAt: string;
  fechaInicio: string;
  fechaFin: string;
  monto: number;
};

function badValidation(
  res: Parameters<RequestHandler>[1],
  err: { issues: { path: (string | number)[]; message: string }[] },
) {
  return res.status(400).json({
    success: false,
    message: "Errores de validación",
    data: null,
    errors: err.issues.map((i) => ({
      field: i.path.join("."),
      message: i.message,
    })),
  } satisfies ApiResponse<null>);
}

type TechoIhssListPayload = {
  items: TechoIhssRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function parsePageQuery(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

export const listTechosIhss: RequestHandler<
  object,
  ApiResponse<TechoIhssListPayload | null>,
  object,
  { page?: string }
> = async (req, res, next) => {
  try {
    const data = await TechoIhssService.list(parsePageQuery(req.query.page));
    return res.json({
      success: true,
      message: "Techos IHSS",
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const createTechoIhss: RequestHandler<
  object,
  ApiResponse<TechoIhssRow | null>
> = async (req, res, next) => {
  const parsed = techoIhssCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return badValidation(res, parsed.error);
  }
  try {
    const data = await TechoIhssService.create(parsed.data);
    return res.status(201).json({
      success: true,
      message: "Techo IHSS creado",
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const updateTechoIhss: RequestHandler<
  { id: string },
  ApiResponse<TechoIhssRow | null>
> = async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({
      success: false,
      message: "ID inválido",
      data: null,
    });
  }
  const parsed = techoIhssUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return badValidation(res, parsed.error);
  }
  try {
    const data = await TechoIhssService.update(id, parsed.data);
    return res.json({
      success: true,
      message: "Techo IHSS actualizado",
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const deleteTechoIhss: RequestHandler<
  { id: string },
  ApiResponse<null>
> = async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({
      success: false,
      message: "ID inválido",
      data: null,
    });
  }
  try {
    await TechoIhssService.delete(id);
    return res.json({
      success: true,
      message: "Techo IHSS eliminado",
      data: null,
    });
  } catch (err) {
    next(err);
  }
};
