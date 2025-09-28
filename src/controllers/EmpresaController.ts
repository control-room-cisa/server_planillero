// src/controllers/EmpresaController.ts
import { RequestHandler } from "express";
import { EmpresaService } from "../services/EmpresaService";
import { ApiResponse } from "../dtos/ApiResponse";
import type {
  EmpresaConDepartamentosDto,
  CreateEmpresaDto,
  UpdateEmpresaDto,
} from "../dtos/empresa.dto";
import type { Empresa } from "@prisma/client";

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
    } satisfies ApiResponse<EmpresaConDepartamentosDto[]>);
  } catch (err) {
    next(err);
  }
};

export const createEmpresa: RequestHandler<
  {}, // params
  ApiResponse<Empresa>, // res body
  any, // req body (validado luego)
  {} // query
> = async (req, res, next) => {
  try {
    const { nombre, codigo, esConsorcio } = req.body;

    // Validaciones básicas
    if (!nombre || !codigo) {
      return res.status(400).json({
        success: false,
        message: "Nombre y código son obligatorios",
        data: null,
      } satisfies ApiResponse<Empresa>);
    }

    const empresa = await EmpresaService.create({
      nombre: nombre.trim(),
      codigo: codigo.trim(),
      esConsorcio: esConsorcio ?? false,
    });

    return res.status(201).json({
      success: true,
      message: "Empresa creada exitosamente",
      data: empresa,
    } satisfies ApiResponse<Empresa>);
  } catch (err) {
    next(err);
  }
};

export const updateEmpresa: RequestHandler<
  { id: string }, // params
  ApiResponse<Empresa>, // res body
  any, // req body (validado luego)
  {} // query
> = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "ID de empresa inválido",
        data: null,
      } satisfies ApiResponse<Empresa>);
    }

    const { nombre, codigo } = req.body;

    // Validaciones básicas
    if (!nombre && !codigo) {
      return res.status(400).json({
        success: false,
        message: "Al menos un campo (nombre o código) debe ser proporcionado",
        data: null,
      } satisfies ApiResponse<Empresa>);
    }

    const empresa = await EmpresaService.update(id, {
      nombre: nombre?.trim(),
      codigo: codigo?.trim(),
    });

    return res.json({
      success: true,
      message: "Empresa actualizada exitosamente",
      data: empresa,
    } satisfies ApiResponse<Empresa>);
  } catch (err) {
    next(err);
  }
};

export const deleteEmpresa: RequestHandler<
  { id: string }, // params
  ApiResponse<Empresa>, // res body
  {}, // req body
  {} // query
> = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "ID de empresa inválido",
        data: null,
      } satisfies ApiResponse<Empresa>);
    }

    const empresa = await EmpresaService.softDelete(id);

    return res.json({
      success: true,
      message: "Empresa eliminada exitosamente",
      data: empresa,
    } satisfies ApiResponse<Empresa>);
  } catch (err) {
    next(err);
  }
};
