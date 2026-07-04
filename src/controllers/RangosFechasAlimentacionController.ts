import { RequestHandler } from "express";
import { ApiResponse } from "../dtos/ApiResponse";
import { RangosFechasAlimentacionService } from "../services/RangosFechasAlimentacionService";
import { RangosFechasAlimentacionRepository } from "../repositories/RangosFechasAlimentacionRepository";
import {
  rangoFechasAlimentacionCreateSchema,
  rangoFechasAlimentacionUpdateSchema,
} from "../validators/rangosFechasAlimentacion.validator";

type RangoRow = {
  id: number;
  codigoNomina: string;
  fechaInicio: string;
  fechaFin: string;
};

type ListRangosPayload = {
  items: RangoRow[];
  idPermiteEdicion: number | null;
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
};

function parsePageQuery(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

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

/** GET /api/rangos-fechas-alimentacion?codigoNomina=202504A | ?page=0 */
export const listRangosFechasAlimentacion: RequestHandler<
  object,
  ApiResponse<ListRangosPayload | null>,
  object,
  { codigoNomina?: string; page?: string }
> = async (req, res, next) => {
  try {
    const codigo = req.query.codigoNomina?.trim();
    if (codigo) {
      const { items, idPermiteEdicion } =
        await RangosFechasAlimentacionService.listRangosPorCodigoConMeta(codigo);
      const data: ListRangosPayload = {
        items: items.map((r) => RangosFechasAlimentacionRepository.toDto(r)),
        idPermiteEdicion,
      };
      return res.json({
        success: true,
        message: "Rangos de alimentación",
        data,
      });
    }

    const data = await RangosFechasAlimentacionService.listPaginated(
      parsePageQuery(req.query.page),
    );
    return res.json({
      success: true,
      message: "Rangos de alimentación",
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const createRangoFechasAlimentacion: RequestHandler<
  object,
  ApiResponse<RangoRow | null>,
  object
> = async (req, res, next) => {
  const parsed = rangoFechasAlimentacionCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return badValidation(res, parsed.error);
  }
  try {
    const data = await RangosFechasAlimentacionService.create(parsed.data);
    return res.status(201).json({
      success: true,
      message: "Rango creado",
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const updateRangoFechasAlimentacion: RequestHandler<
  { id: string },
  ApiResponse<RangoRow | null>
> = async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({
      success: false,
      message: "ID inválido",
      data: null,
    });
  }
  const parsed = rangoFechasAlimentacionUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return badValidation(res, parsed.error);
  }
  try {
    const data = await RangosFechasAlimentacionService.update(id, parsed.data);
    return res.json({
      success: true,
      message: "Rango actualizado",
      data,
    });
  } catch (err) {
    next(err);
  }
};
