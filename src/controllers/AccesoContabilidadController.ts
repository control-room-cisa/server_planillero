import { RequestHandler } from "express";
import { z } from "zod";
import { AccesoContabilidadService } from "../services/AccesoContabilidadService";
import { ApiResponse } from "../dtos/ApiResponse";
import type { AuthRequest } from "../middlewares/authMiddleware";
import type { AccesoContabilidadWithRelations } from "../repositories/AccesoContabilidadRepository";
import {
  createAccesoContabilidadSchema,
  updateAccesoContabilidadSchema,
} from "../validators/accesoContabilidad.validator";

/** GET /api/accesos-contabilidad */
export const listAccesosContabilidad: RequestHandler<
  {},
  ApiResponse<AccesoContabilidadWithRelations[]>
> = async (_req, res, next) => {
  try {
    const data = await AccesoContabilidadService.listActive();
    return res.json({
      success: true,
      message: "Listado de accesos de contabilidad",
      data,
    });
  } catch (err) {
    next(err);
  }
};

/** GET /api/accesos-contabilidad/catalogos */
export const getAccesosContabilidadCatalogos: RequestHandler<
  {},
  ApiResponse<Awaited<ReturnType<typeof AccesoContabilidadService.getCatalogos>>>
> = async (_req, res, next) => {
  try {
    const data = await AccesoContabilidadService.getCatalogos();
    return res.json({
      success: true,
      message: "Catálogos para accesos de contabilidad",
      data,
    });
  } catch (err) {
    next(err);
  }
};

/** GET /api/accesos-contabilidad/:id */
export const getAccesoContabilidad: RequestHandler<
  { id: string },
  ApiResponse<AccesoContabilidadWithRelations>
> = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const data = await AccesoContabilidadService.getByIdActive(id);
    return res.json({
      success: true,
      message: "Detalle del acceso",
      data,
    });
  } catch (err) {
    next(err);
  }
};

/** POST /api/accesos-contabilidad */
export const createAccesoContabilidad: RequestHandler<
  {},
  ApiResponse<AccesoContabilidadWithRelations>,
  unknown
> = async (req, res, next) => {
  try {
    const payload = createAccesoContabilidadSchema.parse(req.body);
    const user = (req as AuthRequest).user;
    const data = await AccesoContabilidadService.create(payload, user.id);
    return res.status(201).json({
      success: true,
      message: "Acceso creado correctamente",
      data,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Error de validación",
        data: null,
      });
    }
    next(err);
  }
};

/** PUT /api/accesos-contabilidad/:id */
export const updateAccesoContabilidad: RequestHandler<
  { id: string },
  ApiResponse<AccesoContabilidadWithRelations>,
  unknown
> = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const payload = updateAccesoContabilidadSchema.parse(req.body);
    const user = (req as AuthRequest).user;
    const data = await AccesoContabilidadService.updateWithHistory(
      id,
      payload,
      user.id
    );
    return res.json({
      success: true,
      message: "Acceso actualizado (nuevo registro en historial)",
      data,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Error de validación",
        data: null,
      });
    }
    next(err);
  }
};

/** DELETE /api/accesos-contabilidad/:id (soft delete) */
export const deleteAccesoContabilidad: RequestHandler<
  { id: string },
  ApiResponse<null>
> = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const user = (req as AuthRequest).user;
    await AccesoContabilidadService.softDelete(id, user.id);
    return res.json({
      success: true,
      message: "Acceso eliminado",
      data: null,
    });
  } catch (err) {
    next(err);
  }
};
