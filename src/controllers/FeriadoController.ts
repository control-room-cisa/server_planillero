// src/controllers/FeriadoController.ts
import { RequestHandler } from "express";
import { FeriadoService } from "../services/FeriadoService";
import { ApiResponse } from "../dtos/ApiResponse";
import type { Feriado, Prisma } from "@prisma/client";
import { createFeriadoSchema } from "../validators/feriado.validator";

/** GET /api/feriados */
export const listFeriados: RequestHandler<
  {}, // params
  ApiResponse<Feriado[]>, // res body
  {}, // req body
  {} // query
> = async (_req, res, next) => {
  try {
    const feriados = await FeriadoService.listFeriados();
    return res.json({
      success: true,
      message: "Listado de feriados",
      data: feriados,
    });
  } catch (err) {
    next(err);
  }
};

/** GET /api/feriados/:fecha (YYYY-MM-DD) */
export const getFeriadoByDate: RequestHandler<
  { fecha: string }, // params
  ApiResponse<Feriado>, // res body
  {}, // req body
  {} // query
> = async (req, res, next) => {
  try {
    const fecha = req.params.fecha;
    const feriado = await FeriadoService.getFeriadoByDate(fecha);
    return res.json({
      success: true,
      message: `Feriado para la fecha ${fecha}`,
      data: feriado,
    });
  } catch (err) {
    next(err);
  }
};

/** POST /api/feriados */
export const createFeriado: RequestHandler<
  {}, // params
  ApiResponse<Feriado>, // res
  any, // req.body sin tipar aún
  {} // query
> = async (req, res, next) => {
  // Validar formato del body
  const parsed = createFeriadoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Errores de validación",
      data: null,
      errors: parsed.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    } satisfies ApiResponse<Feriado>);
  }

  try {
    const newFeriado = await FeriadoService.createFeriado(parsed.data);
    return res.status(201).json({
      success: true,
      message: "Feriado creado correctamente",
      data: newFeriado,
    });
  } catch (err) {
    next(err);
  }
};

/** PUT /api/feriados/:id */
export const updateFeriado: RequestHandler<
  { id: string }, // params
  ApiResponse<Feriado>, // res body
  Prisma.FeriadoUpdateInput, // req body
  {} // query
> = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const updated = await FeriadoService.updateFeriado(id, req.body);
    return res.json({
      success: true,
      message: `Feriado ${id} actualizado`,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

/** DELETE /api/feriados/:id */
export const deleteFeriado: RequestHandler<
  { id: string }, // params
  ApiResponse<null>, // res body
  {}, // req body
  {} // query
> = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await FeriadoService.deleteFeriado(id);
    return res.json({
      success: true,
      message: `Feriado ${id} eliminado`,
      data: null,
    });
  } catch (err) {
    next(err);
  }
};
