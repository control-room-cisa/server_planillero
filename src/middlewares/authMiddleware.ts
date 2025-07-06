// src/middlewares/authMiddleware.ts
import { RequestHandler,Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { ApiResponse } from '../dtos/ApiResponse';

interface JwtPayload {
  id: number;
  correo: string;
}

// Sólo para cuando necesites usarlo en controllers:
export interface AuthRequest<B = any> extends Request<any, any, B> {

  user: JwtPayload;
}

// Ahora `authenticateJWT` es un RequestHandler puro
export const authenticateJWT: RequestHandler = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Token no proporcionado',
      data: null
    } as ApiResponse<null>);
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET || 'supersecretkey'
    ) as JwtPayload;

    // Aquí casteamos `req` a AuthRequest para adjuntar `user`
    (req as unknown as AuthRequest).user = payload;

    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: 'Token inválido o expirado',
      data: null
    } as ApiResponse<null>);
  }
};
