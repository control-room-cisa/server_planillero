import type { RequestHandler } from "express";
import type { GlobalConfig } from "@prisma/client";
import type { ApiResponse } from "../dtos/ApiResponse";
import { z } from "zod";
import { GlobalConfigService } from "../services/GlobalConfigService";
import { globalConfigUpsertSchema } from "../validators/globalConfig.validator";

export const listGlobalConfig: RequestHandler<
  {},
  ApiResponse<GlobalConfig[]>
> = async (_req, res, next) => {
  try {
    const data = await GlobalConfigService.list();
    return res.json({
      success: true,
      message: "Listado de configuración global",
      data,
    } as ApiResponse<GlobalConfig[]>);
  } catch (err) {
    // Mensaje amigable si Prisma no tiene el delegate/modelo aún
    if (String((err as any)?.message || "").includes("GlobalConfig no está disponible")) {
      return res.status(500).json({
        success: false,
        message: (err as any).message,
        data: null,
      } as ApiResponse<GlobalConfig[]>);
    }
    next(err);
  }
};

export const getGlobalConfig: RequestHandler<
  { key: string },
  ApiResponse<GlobalConfig | null>
> = async (req, res, next) => {
  try {
    const key = String(req.params.key || "").trim();
    if (!key) {
      return res.status(400).json({
        success: false,
        message: "Key inválida",
        data: null,
      } as ApiResponse<GlobalConfig | null>);
    }
    const data = await GlobalConfigService.get(key);
    return res.json({
      success: true,
      message: "Configuración global",
      data,
    } as ApiResponse<GlobalConfig | null>);
  } catch (err) {
    if (String((err as any)?.message || "").includes("GlobalConfig no está disponible")) {
      return res.status(500).json({
        success: false,
        message: (err as any).message,
        data: null,
      } as ApiResponse<GlobalConfig | null>);
    }
    next(err);
  }
};

export const upsertGlobalConfig: RequestHandler<
  {},
  ApiResponse<GlobalConfig>,
  unknown
> = async (req, res, next) => {
  try {
    const payload = globalConfigUpsertSchema.parse(req.body);
    const data = await GlobalConfigService.upsert(payload);
    return res.json({
      success: true,
      message: "Configuración guardada",
      data,
    } as ApiResponse<GlobalConfig>);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Datos inválidos",
        data: null,
        errors: err.errors.map((e) => ({
          field: String(e.path?.[0] ?? "body"),
          message: e.message,
        })),
      } as ApiResponse<GlobalConfig>);
    }
    if (String(err?.message || "").includes("GlobalConfig no está disponible")) {
      return res.status(500).json({
        success: false,
        message: err.message,
        data: null,
      } as ApiResponse<GlobalConfig>);
    }
    next(err);
  }
};

export const deleteGlobalConfig: RequestHandler<
  { key: string },
  ApiResponse<null>
> = async (req, res, next) => {
  try {
    const key = String(req.params.key || "").trim();
    if (!key) {
      return res.status(400).json({
        success: false,
        message: "Key inválida",
        data: null,
      } as ApiResponse<null>);
    }
    await GlobalConfigService.delete(key);
    return res.json({
      success: true,
      message: "Configuración eliminada",
      data: null,
    } as ApiResponse<null>);
  } catch (err: any) {
    if (err?.message === "Config no encontrada") {
      return res.status(404).json({
        success: false,
        message: err.message,
        data: null,
      } as ApiResponse<null>);
    }
    if (String(err?.message || "").includes("GlobalConfig no está disponible")) {
      return res.status(500).json({
        success: false,
        message: err.message,
        data: null,
      } as ApiResponse<null>);
    }
    next(err);
  }
};

