// src/controllers/DepartamentoController.ts
import { RequestHandler } from "express";
import { DepartamentoService } from "../services/DepartamentoService";
import { ApiResponse } from "../dtos/ApiResponse";
import type { Departamento } from "@prisma/client";

export const listDepartamentos: RequestHandler<
  {}, // params
  ApiResponse<Departamento[]>, // res body
  {}, // req body
  { empresaId?: string } // query
> = async (req, res, next) => {
  try {
    const empresaIdStr = req.query.empresaId;
    if (!empresaIdStr) {
      return res.status(400).json({
        success: false,
        message: "El parámetro empresaId es obligatorio",
        data: null,
      } as ApiResponse<Departamento[]>);
    }

    const empresaId = Number(empresaIdStr);
    if (!Number.isFinite(empresaId) || empresaId <= 0) {
      return res.status(400).json({
        success: false,
        message: "ID de empresa inválido",
        data: null,
      } as ApiResponse<Departamento[]>);
    }

    const data = await DepartamentoService.listByEmpresa(empresaId);
    return res.json({
      success: true,
      message: "Listado de departamentos",
      data,
    } as ApiResponse<Departamento[]>);
  } catch (err) {
    next(err);
  }
};

export const getDepartamento: RequestHandler<
  { id: string }, // params
  ApiResponse<Departamento>, // res body
  {} // req body
> = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({
        success: false,
        message: "ID inválido",
        data: null,
      } as ApiResponse<Departamento>);
    }

    const data = await DepartamentoService.getById(id);
    return res.json({
      success: true,
      message: "Departamento obtenido exitosamente",
      data,
    } as ApiResponse<Departamento>);
  } catch (err: any) {
    if (err.message === "Departamento no encontrado") {
      return res.status(404).json({
        success: false,
        message: err.message,
        data: null,
      } as ApiResponse<Departamento>);
    }
    next(err);
  }
};

export const createDepartamento: RequestHandler<
  {}, // params
  ApiResponse<Departamento>, // res body
  any // req body (validado por middleware)
> = async (req, res, next) => {
  try {
    const departamento = await DepartamentoService.create(req.body);
    return res.status(201).json({
      success: true,
      message: "Departamento creado exitosamente",
      data: departamento,
    } as ApiResponse<Departamento>);
  } catch (err: any) {
    if (err.message.includes("Ya existe")) {
      return res.status(400).json({
        success: false,
        message: err.message,
        data: null,
      } as ApiResponse<Departamento>);
    }
    next(err);
  }
};

export const updateDepartamento: RequestHandler<
  { id: string }, // params
  ApiResponse<Departamento>, // res body
  any // req body (validado por middleware)
> = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({
        success: false,
        message: "ID inválido",
        data: null,
      } as ApiResponse<Departamento>);
    }

    const departamento = await DepartamentoService.update(id, req.body);
    return res.json({
      success: true,
      message: "Departamento actualizado exitosamente",
      data: departamento,
    } as ApiResponse<Departamento>);
  } catch (err: any) {
    if (err.message === "Departamento no encontrado") {
      return res.status(404).json({
        success: false,
        message: err.message,
        data: null,
      } as ApiResponse<Departamento>);
    }
    if (err.message.includes("Ya existe")) {
      return res.status(400).json({
        success: false,
        message: err.message,
        data: null,
      } as ApiResponse<Departamento>);
    }
    next(err);
  }
};

export const deleteDepartamento: RequestHandler<
  { id: string }, // params
  ApiResponse<Departamento>, // res body
  {} // req body
> = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({
        success: false,
        message: "ID inválido",
        data: null,
      } as ApiResponse<Departamento>);
    }

    const departamento = await DepartamentoService.delete(id);
    return res.json({
      success: true,
      message: "Departamento eliminado exitosamente",
      data: departamento,
    } as ApiResponse<Departamento>);
  } catch (err: any) {
    if (
      err.message === "Departamento no encontrado" ||
      err.message === "El departamento ya fue eliminado"
    ) {
      return res.status(400).json({
        success: false,
        message: err.message,
        data: null,
      } as ApiResponse<Departamento>);
    }
    next(err);
  }
};

