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
    });
  } catch (err) {
    next(err);
  }
};
