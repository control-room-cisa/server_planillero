import { RequestHandler } from "express";
import type { Vehiculo } from "@prisma/client";
import { ApiResponse } from "../dtos/ApiResponse";
import { VehiculoService } from "../services/VehiculoService";

/** GET /api/vehiculos */
export const listVehiculos: RequestHandler<
  {},
  ApiResponse<Vehiculo[]>,
  {},
  {}
> = async (_req, res, next) => {
  try {
    const vehiculos = await VehiculoService.listVehiculos();
    return res.json({
      success: true,
      message: "Listado de vehiculos",
      data: vehiculos,
    } as ApiResponse<Vehiculo[]>);
  } catch (err) {
    next(err);
  }
};

/** GET /api/vehiculos/:id */
export const getVehiculo: RequestHandler<
  { id: string },
  ApiResponse<Vehiculo>,
  {}
> = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({
        success: false,
        message: "ID inválido",
        data: null,
      } as ApiResponse<Vehiculo>);
    }

    const data = await VehiculoService.getById(id);
    return res.json({
      success: true,
      message: "Vehículo obtenido exitosamente",
      data,
    } as ApiResponse<Vehiculo>);
  } catch (err: any) {
    if (err.message === "Vehículo no encontrado") {
      return res.status(404).json({
        success: false,
        message: err.message,
        data: null,
      } as ApiResponse<Vehiculo>);
    }
    next(err);
  }
};

/** POST /api/vehiculos */
export const createVehiculo: RequestHandler<
  {},
  ApiResponse<Vehiculo>,
  any
> = async (req, res, next) => {
  try {
    const vehiculo = await VehiculoService.create(req.body);
    return res.status(201).json({
      success: true,
      message: "Vehículo creado exitosamente",
      data: vehiculo,
    } as ApiResponse<Vehiculo>);
  } catch (err: any) {
    if (err.message.includes("Ya existe") || err.message.includes("obligatorio")) {
      return res.status(400).json({
        success: false,
        message: err.message,
        data: null,
      } as ApiResponse<Vehiculo>);
    }
    if (err?.code === "P2002") {
      return res.status(400).json({
        success: false,
        message:
          "Ya existe un vehículo con ese class. No se permiten duplicados.",
        data: null,
      } as ApiResponse<Vehiculo>);
    }
    next(err);
  }
};

/** PUT /api/vehiculos/:id */
export const updateVehiculo: RequestHandler<
  { id: string },
  ApiResponse<Vehiculo>,
  any
> = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({
        success: false,
        message: "ID inválido",
        data: null,
      } as ApiResponse<Vehiculo>);
    }

    const vehiculo = await VehiculoService.update(id, req.body);
    return res.json({
      success: true,
      message: "Vehículo actualizado exitosamente",
      data: vehiculo,
    } as ApiResponse<Vehiculo>);
  } catch (err: any) {
    if (err.message === "Vehículo no encontrado") {
      return res.status(404).json({
        success: false,
        message: err.message,
        data: null,
      } as ApiResponse<Vehiculo>);
    }
    if (err.message.includes("Ya existe") || err.message.includes("obligatorio")) {
      return res.status(400).json({
        success: false,
        message: err.message,
        data: null,
      } as ApiResponse<Vehiculo>);
    }
    if (err?.code === "P2002") {
      return res.status(400).json({
        success: false,
        message:
          "Ya existe un vehículo con ese class. No se permiten duplicados.",
        data: null,
      } as ApiResponse<Vehiculo>);
    }
    next(err);
  }
};

/** DELETE /api/vehiculos/:id */
export const deleteVehiculo: RequestHandler<
  { id: string },
  ApiResponse<Vehiculo>,
  {}
> = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({
        success: false,
        message: "ID inválido",
        data: null,
      } as ApiResponse<Vehiculo>);
    }

    const vehiculo = await VehiculoService.delete(id);
    return res.json({
      success: true,
      message: "Vehículo eliminado exitosamente",
      data: vehiculo,
    } as ApiResponse<Vehiculo>);
  } catch (err: any) {
    if (
      err.message === "Vehículo no encontrado" ||
      err.message === "El vehículo ya fue eliminado"
    ) {
      return res.status(400).json({
        success: false,
        message: err.message,
        data: null,
      } as ApiResponse<Vehiculo>);
    }
    next(err);
  }
};
