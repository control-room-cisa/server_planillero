import type { RequestHandler }  from "express";
import type { AuthRequest }     from "../middlewares/authMiddleware";
import { EmpleadoService }      from "../services/EmpleadoService";
import type { ApiResponse }     from "../dtos/ApiResponse";
import { EmployeeDto } from "../dtos/employee";

export const listByDepartment: RequestHandler<
  {},                            // params
  ApiResponse<EmployeeDto[]>,    // response
  {},                            // body
  {}                             // query
> = async (req, res, next) => {
  try {
    const user = (req as AuthRequest).user;

    if (user.rolId !== 2) {
      return res.status(403).json({
        success: false,
        message: "Solo supervisores",
        data: []
      });
    }

    const empleados = await EmpleadoService.getByDepartment(user.departamentoId);

    res.json({
      success: true,
      message: "Empleados de tu departamento",
      data: empleados
    });
  } catch (err) {
    next(err);
  }
};

export const listByCompany: RequestHandler<
  {},                            // params
  ApiResponse<EmployeeDto[]>,    // response
  {},                            // body
  { empresaId?: string }         // query
> = async (req, res, next) => {
  try {
    const user = (req as AuthRequest).user;

    // Solo RRHH puede acceder a esta ruta
    if (user.rolId !== 3) {
      return res.status(403).json({
        success: false,
        message: "Solo personal de RRHH puede acceder a esta funcionalidad",
        data: []
      });
    }

    // Si se proporciona un ID de empresa, usarlo; de lo contrario, obtener todos los empleados
    const empresaId = req.query.empresaId ? parseInt(req.query.empresaId, 10) : undefined;
    
    if (req.query.empresaId && isNaN(empresaId!)) {
      return res.status(400).json({
        success: false,
        message: "ID de empresa inválido",
        data: []
      });
    }

    const empleados = await EmpleadoService.getByCompany(empresaId);

    res.json({
      success: true,
      message: "Empleados por empresa",
      data: empleados
    });
  } catch (err) {
    next(err);
  }
};
