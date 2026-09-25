import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { ApiResponse } from "../dtos/ApiResponse";
import { prisma } from "../config/prisma";
import { rolIdsFromRelations } from "../utils/roles";
import { getJwtSecret } from "../config/jwt";
import type { AuthRequest } from "./authMiddleware";

/**
 * Igual que authenticateJWT, pero también acepta `?token=` (para /uploads en <img>/<a>).
 */
export const authenticateJWTOrQueryToken: RequestHandler = async (
  req,
  res,
  next
) => {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (typeof req.query.token === "string" && req.query.token.trim()) {
    token = req.query.token.trim();
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Token no proporcionado",
      data: null,
    } as ApiResponse<null>);
  }

  try {
    const payload = jwt.verify(token, getJwtSecret()) as { id: number };

    const empleado = await prisma.empleado.findFirst({
      where: {
        id: payload.id,
        deletedAt: null,
      },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        apellido: true,
        correoElectronico: true,
        departamentoId: true,
        activo: true,
        roles: { select: { rolId: true } },
      },
    });

    if (!empleado) {
      return res.status(401).json({
        success: false,
        message: "Usuario no encontrado",
        data: null,
      } as ApiResponse<null>);
    }

    if (!empleado.activo) {
      return res.status(403).json({
        success: false,
        message:
          "Su cuenta está desactivada. Comuníquese con recursos humanos.",
        data: null,
      } as ApiResponse<null>);
    }

    const { roles, activo: _activo, ...rest } = empleado;
    (req as AuthRequest).user = {
      ...rest,
      rolIds: rolIdsFromRelations(roles),
    };

    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Token inválido o expirado",
      data: null,
    } as ApiResponse<null>);
  }
};
