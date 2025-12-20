// src/middlewares/authorizeRoles.ts
import { RequestHandler, Response } from "express";
import { AuthRequest } from "./authMiddleware";
import { ApiResponse } from "../dtos/ApiResponse";
import { Roles } from "../enums/roles";

/**
 * Middleware para autorizar acceso basado en roles
 * @param allowedRoles - Array de roles permitidos
 * @returns RequestHandler que valida si el usuario tiene uno de los roles permitidos
 */
export const authorizeRoles = (
  ...allowedRoles: Roles[]
): RequestHandler => {
  return (req, res, next) => {
    const authReq = req as AuthRequest;
    const user = authReq.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "No autenticado",
        data: null,
      } as ApiResponse<null>);
    }

    if (!allowedRoles.includes(user.rolId as Roles)) {
      return res.status(403).json({
        success: false,
        message: "No autorizado. No tienes permisos para realizar esta acción",
        data: null,
      } as ApiResponse<null>);
    }

    next();
  };
};

