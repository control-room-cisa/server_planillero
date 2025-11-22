// src/controllers/PlanillaAccesoRevisionController.ts
import { RequestHandler } from "express";
import { PlanillaAccesoRevisionService } from "../services/PlanillaAccesoRevisionService";
import { ApiResponse } from "../dtos/ApiResponse";
import type { PlanillaAcceso } from "@prisma/client";
import {
  createPlanillaAccesoRevisionSchema,
  updatePlanillaAccesoRevisionSchema,
} from "../validators/planillaAccesoRevision.validator";
import { z } from "zod";

/** GET /api/planilla-acceso-revision */
export const listPlanillaAccesoRevision: RequestHandler<
  {}, // params
  ApiResponse<PlanillaAcceso[]>, // res body
  {}, // req body
  {
    supervisorId?: string;
    empleadoId?: string;
  }
> = async (req, res, next) => {
  try {
    const supervisorId = req.query.supervisorId
      ? Number(req.query.supervisorId)
      : undefined;
    const empleadoId = req.query.empleadoId
      ? Number(req.query.empleadoId)
      : undefined;

    const accesos = await PlanillaAccesoRevisionService.listPlanillaAccesoRevision(
      {
        supervisorId,
        empleadoId,
      }
    );

    return res.json({
      success: true,
      message: "Listado de accesos de planilla",
      data: accesos,
    });
  } catch (err) {
    next(err);
  }
};

/** GET /api/planilla-acceso-revision/:id */
export const getPlanillaAccesoRevision: RequestHandler<
  { id: string }, // params
  ApiResponse<PlanillaAcceso>, // res body
  {}, // req body
  {} // query
> = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const acceso = await PlanillaAccesoRevisionService.getPlanillaAccesoRevisionById(
      id
    );
    return res.json({
      success: true,
      message: `Detalles del acceso de planilla ${id}`,
      data: acceso,
    });
  } catch (err) {
    next(err);
  }
};

/** POST /api/planilla-acceso-revision */
export const createPlanillaAccesoRevision: RequestHandler<
  {},
  ApiResponse<PlanillaAcceso>
> = async (req, res, next) => {
  try {
    const payload = createPlanillaAccesoRevisionSchema.parse(req.body);
    const newAcceso =
      await PlanillaAccesoRevisionService.createPlanillaAccesoRevision(payload);
    return res.status(201).json({
      success: true,
      message: "Acceso de planilla creado correctamente",
      data: newAcceso,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res
        .status(400)
        .json({ success: false, message: "Error de validación", data: null });
    }
    next(err);
  }
};

/** PUT /api/planilla-acceso-revision/:id */
export const updatePlanillaAccesoRevision: RequestHandler<
  { id: string },
  ApiResponse<PlanillaAcceso>
> = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const payload = updatePlanillaAccesoRevisionSchema.parse(req.body);
    const updated =
      await PlanillaAccesoRevisionService.updatePlanillaAccesoRevision(
        id,
        payload
      );
    return res.json({
      success: true,
      message: `Acceso de planilla ${id} actualizado`,
      data: updated,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res
        .status(400)
        .json({ success: false, message: "Error de validación", data: null });
    }
    next(err);
  }
};

/** DELETE /api/planilla-acceso-revision/:id */
export const deletePlanillaAccesoRevision: RequestHandler<
  { id: string }, // params
  ApiResponse<null>, // res body
  {}, // req body
  {} // query
> = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await PlanillaAccesoRevisionService.deletePlanillaAccesoRevision(id);
    return res.json({
      success: true,
      message: `Acceso de planilla ${id} eliminado`,
      data: null,
    });
  } catch (err) {
    next(err);
  }
};








