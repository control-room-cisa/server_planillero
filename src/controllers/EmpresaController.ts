// src/controllers/EmpresaController.ts
import { RequestHandler } from "express";
import { EmpresaService } from "../services/EmpresaService";
import { ApiResponse } from "../dtos/ApiResponse";
import type { EmpresaConDepartamentosDto } from "../dtos/empresa.dto";

export const listEmpresasConDepartamentos: RequestHandler<
  {}, // params
  ApiResponse<EmpresaConDepartamentosDto[]>, // res body
  {}, // req body
  {} // query
> = async (_req, res, next) => {
  try {
    const empresas = await EmpresaService.listWithDepartments();
    // casteo directo porque las propiedades y tipos coinciden con el DTO
    return res.json({
      success: true,
      message: "Listado de empresas con sus departamentos",
      data: empresas as EmpresaConDepartamentosDto[],
    });
  } catch (err) {
    next(err);
  }
};
