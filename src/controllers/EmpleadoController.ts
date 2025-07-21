import type { RequestHandler } from "express";
import type { AuthRequest } from "../middlewares/authMiddleware";
import { EmpleadoService } from "../services/EmpleadoService";
import {
  CreateEmpleadoDto,
  EmployeeDto,
  UpdateEmpleadoDto,
} from "../dtos/employee.dto";
import {
  createEmpleadoSchema,
  updateEmpleadoSchema,
} from "../validators/empleado.validator";
import type { ApiResponse } from "../dtos/ApiResponse";

// Create
// CREATE
export const createEmpleado: RequestHandler<
  {}, // params
  ApiResponse<EmployeeDto>, // response
  CreateEmpleadoDto, // body
  {} // query
> = async (req, res, next) => {
  // 1) Validación
  const parsed = createEmpleadoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Errores de validación",
      data: null,
      errors: parsed.error
        .format()
        ._errors.map((msg) => ({ field: "_", message: msg })),
    });
  }

  try {
    // 2) Crear en DB
    parsed.data.codigo = await EmpleadoService.generateCodigo();
    const emp = await EmpleadoService.createEmpleado(parsed.data);
    // 3) Mapear a DTO de salida
    const dto: EmployeeDto = {
      id: emp.id,
      nombre: emp.nombre,
      apellido: emp.apellido ?? undefined,
      codigo: emp.codigo ?? undefined,
    };

    // 4) Responder
    return res.status(201).json({
      success: true,
      message: "Empleado creado correctamente",
      data: dto,
    } as ApiResponse<EmployeeDto>);
  } catch (err) {
    next(err);
  }
};

// UPDATE
export const updateEmpleado: RequestHandler<
  {}, // params
  ApiResponse<EmployeeDto>, // response
  UpdateEmpleadoDto, // body
  {} // query
> = async (req, res, next) => {
  // 1) Validación
  const parsed = updateEmpleadoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Errores de validación",
      data: null,
      errors: parsed.error
        .format()
        ._errors.map((msg) => ({ field: "_", message: msg })),
    });
  }

  try {
    // 2) Actualizar en DB
    const { id, ...rest } = parsed.data;
    const emp = await EmpleadoService.updateEmpleado(id, rest);

    // 3) Mapear a DTO de salida
    const dto: EmployeeDto = {
      id: emp.id,
      nombre: emp.nombre,
      apellido: emp.apellido ?? undefined,
      codigo: emp.codigo ?? undefined,
    };

    // 4) Responder
    return res.status(200).json({
      success: true,
      message: "Empleado actualizado correctamente",
      data: dto,
    } as ApiResponse<EmployeeDto>);
  } catch (err) {
    next(err);
  }
};
export const listByDepartment: RequestHandler<
  {}, // params
  ApiResponse<EmployeeDto[]>, // response
  {}, // body
  {} // query
> = async (req, res, next) => {
  try {
    const user = (req as AuthRequest).user;

    if (user.rolId !== 2) {
      return res.status(403).json({
        success: false,
        message: "Solo supervisores",
        data: [],
      });
    }

    const empleados = await EmpleadoService.getByDepartment(
      user.departamentoId
    );

    res.json({
      success: true,
      message: "Empleados de tu departamento",
      data: empleados,
    });
  } catch (err) {
    next(err);
  }
};

export const listByCompany: RequestHandler<
  {}, // params
  ApiResponse<EmployeeDto[]>, // response
  {}, // body
  { empresaId?: string } // query
> = async (req, res, next) => {
  try {
    const user = (req as AuthRequest).user;

    // Solo RRHH puede acceder a esta ruta
    if (user.rolId !== 3) {
      return res.status(403).json({
        success: false,
        message: "Solo personal de RRHH puede acceder a esta funcionalidad",
        data: [],
      });
    }

    // Si se proporciona un ID de empresa, usarlo; de lo contrario, obtener todos los empleados
    const empresaId = req.query.empresaId
      ? parseInt(req.query.empresaId, 10)
      : undefined;

    if (req.query.empresaId && isNaN(empresaId!)) {
      return res.status(400).json({
        success: false,
        message: "ID de empresa inválido",
        data: [],
      });
    }

    const empleados = await EmpleadoService.getByCompany(empresaId);

    res.json({
      success: true,
      message: "Empleados por empresa",
      data: empleados,
    });
  } catch (err) {
    next(err);
  }
};
