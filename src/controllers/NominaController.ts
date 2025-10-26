// src/controllers/NominaController.ts
import { RequestHandler } from "express";
import { NominaService } from "../services/NominaService";
import { ApiResponse } from "../dtos/ApiResponse";
import { z } from "zod";
import {
  crearNominaSchema,
  actualizarNominaSchema,
} from "../validators/nomina.validator";
import type {
  CrearNominaDto,
  ActualizarNominaDto,
} from "../validators/nomina.validator";
import type { Nomina } from "@prisma/client";
import { AuthRequest } from "../middlewares/authMiddleware";

export const leerNominas: RequestHandler<
  {},
  ApiResponse<Nomina[]>,
  {},
  { empleadoId?: string; empresaId?: string; start?: string; end?: string }
> = async (req, res, next) => {
  try {
    const empleadoId = req.query.empleadoId
      ? Number(req.query.empleadoId)
      : undefined;
    const empresaId = req.query.empresaId
      ? Number(req.query.empresaId)
      : undefined;
    const { start, end } = req.query;

    const data = await NominaService.list({
      empleadoId,
      empresaId,
      start,
      end,
    });
    return res.json({ success: true, message: "Listado de nóminas", data });
  } catch (err) {
    next(err);
  }
};

export const crearNomina: RequestHandler<
  {},
  ApiResponse<Nomina>,
  CrearNominaDto
> = async (req, res, next) => {
  try {
    const payload = crearNominaSchema.parse(req.body);
    const user = (req as AuthRequest).user;
    const created = await NominaService.create(
      {
        ...payload,
      },
      // código del empleado creador, si existe (campo opcional en schema)
      (user as any)?.codigo ?? null
    );
    return res.status(201).json({
      success: true,
      message: "Nómina creada",
      data: created,
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

export const actualizarNomina: RequestHandler<
  { id: string },
  ApiResponse<Nomina>,
  ActualizarNominaDto
> = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const payload = actualizarNominaSchema.parse(req.body);
    const updated = await NominaService.update(id, payload);
    return res.json({
      success: true,
      message: "Nómina actualizada",
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
