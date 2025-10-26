// src/middlewares/authMiddleware.ts
import { RequestHandler, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { ApiResponse } from "../dtos/ApiResponse";
import { prisma } from "../config/prisma";

interface JwtPayload {
  id: number;
  correo: string;
}

// Sólo para cuando necesites usarlo en controllers:
export interface AuthRequest<B = any> extends Request<any, any, B> {
  user: {
    id: number;
    codigo: string | null;
    nombre: string;
    apellido: string | null;
    correoElectronico: string | null;
    departamentoId: number;
    rolId: number;
  };
}

// Ahora `authenticateJWT` es un RequestHandler puro
export const authenticateJWT: RequestHandler = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Token no proporcionado",
      data: null,
    } as ApiResponse<null>);
  }

  const token = authHeader.split(" ")[1];
  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET || "supersecretkey"
    ) as JwtPayload;

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
        rolId: true,
      },
    });
    if (!empleado) {
      return res.status(401).json({
        success: false,
        message: "Usuario no encontrado",
        data: null,
      } as ApiResponse<null>);
    }

    // 2) Asignamos req.user con todos los datos necesarios
    (req as AuthRequest).user = empleado;

    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Token inválido o expirado",
      data: null,
    } as ApiResponse<null>);
  }
};
