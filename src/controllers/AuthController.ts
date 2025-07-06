import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import { ApiResponse } from '../dtos/ApiResponse';

export class AuthController {
  static async register(req: Request, res: Response<ApiResponse<any>>, next: NextFunction) {
    try {
      const {
        nombre,
        apellido,
        correoElectronico,
        contrasena,
        departamentoId
      } = req.body;

      const empleado = await AuthService.register(
        nombre,
        apellido,
        correoElectronico,
        contrasena,
        departamentoId,
        1 //Establecer rol de Empleado 
      );

      res.status(201).json({
        success: true,
        message: 'Registro exitoso',
        data: empleado
      });
    } catch (err) {
      next(err);
    }
  }

  static async login(req: Request, res: Response<ApiResponse<any>>, next: NextFunction) {
    try {
      const { correoElectronico, contrasena } = req.body;
      const result = await AuthService.login(correoElectronico, contrasena);
      res.json({
        success: true,
        message: 'Login exitoso',
        data: result
      });
    } catch (error: any) {
      next(error);
    }
  }
}
