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
