import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/AuthService";
import { ApiResponse } from "../dtos/ApiResponse";

export class AuthController {
  static async register(
    req: Request,
    res: Response<ApiResponse<any>>,
    next: NextFunction
  ) {
    try {
      const {
        nombre,
        apellido,
        correoElectronico,
        contrasena,
        departamentoId,
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
        message: "Registro exitoso",
        data: empleado,
      });
    } catch (err) {
      next(err);
    }
  }

  static async login(
    req: Request,
    res: Response<ApiResponse<any>>,
    next: NextFunction
  ) {
    try {
      const { usuario, correoElectronico, dni, contrasena } = req.body;
      // Aceptar cualquiera de los tres: usuario, correoElectronico o dni
      const identifier = usuario || correoElectronico || dni;

      if (!identifier) {
        return res.status(400).json({
          success: false,
          message: "Debe proporcionar un usuario, correo electrónico o DNI",
          data: null,
        });
      }

      if (!contrasena) {
        return res.status(400).json({
          success: false,
          message: "Debe proporcionar una contraseña",
          data: null,
        });
      }

      const result = await AuthService.login(identifier, contrasena);
      res.json({
        success: true,
        message: "Login exitoso",
        data: result,
      });
    } catch (error: any) {
      next(error);
    }
  }

  static async changePassword(
    req: Request,
    res: Response<ApiResponse<any>>,
    next: NextFunction
  ) {
    try {
      const { usuario, correoElectronico, dni, contrasenaActual, nuevaContrasena } = req.body;
      // Aceptar cualquiera de los tres: usuario, correoElectronico o dni
      const identifier = usuario || correoElectronico || dni;

      if (!identifier) {
        return res.status(400).json({
          success: false,
          message: "Debe proporcionar un usuario, correo electrónico o DNI",
          data: null,
        });
      }

      if (!contrasenaActual) {
        return res.status(400).json({
          success: false,
          message: "Debe proporcionar la contraseña actual",
          data: null,
        });
      }

      if (!nuevaContrasena) {
        return res.status(400).json({
          success: false,
          message: "Debe proporcionar la nueva contraseña",
          data: null,
        });
      }

      await AuthService.changePassword(identifier, contrasenaActual, nuevaContrasena);
      
      res.json({
        success: true,
        message: "Contraseña actualizada exitosamente",
        data: null,
      });
    } catch (error: any) {
      next(error);
    }
  }
}
