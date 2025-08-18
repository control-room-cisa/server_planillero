// src/controllers/empleados.controller.ts
import type { RequestHandler } from "express";
import type { AuthRequest } from "../middlewares/authMiddleware";
import { EmpleadoService } from "../services/EmpleadoService";
import {
  CreateEmpleadoDto,
  EmployeeDto,
  EmployeeDetailDto,
  UpdateEmpleadoDto,
} from "../dtos/employee.dto";
import {
  createEmpleadoSchema,
  updateEmpleadoSchema,
} from "../validators/empleado.validator";
import type { ApiResponse } from "../dtos/ApiResponse";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

// Lee archivos provenientes de multer.fields([{name:'foto'},{name:'cv'}])
type MulterFilesMap = { [field: string]: Express.Multer.File[] } | undefined;
const getFiles = (req: any) => {
  const files = req.files as MulterFilesMap;
  return {
    foto: files?.foto?.[0],
    cv: files?.cv?.[0],
  };
};

/**
 * Opción 1 (recomendada): Body multipart/form-data con:
 *  - empleado: (Text) JSON del DTO (sin foto ni cv)
 *  - foto: (File) opcional
 *  - cv: (File)   opcional
 *
 * Esta función extrae y parsea el JSON del campo `empleado`.
 */
function parseEmpleadoBody<T = any>(req: any): T {
  // Si viene como form-data, `empleado` será un string con JSON
  const raw = req.body?.empleado ?? req.body;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as T;
    } catch {
      // Lanzamos para que el controlador responda 400 acorde
      throw new Error("JSON inválido en el campo 'empleado'.");
    }
  }
  if (typeof raw === "object" && raw !== null) {
    return raw as T;
  }
  throw new Error("Body inválido. Envía el JSON en el campo 'empleado'.");
}

// -----------------------------------------------------------------------------
// CREATE (con archivos). Guardado en servidor lo maneja EmpleadoService.
// -----------------------------------------------------------------------------
export const createEmpleado: RequestHandler<
  {}, // params
  ApiResponse<EmployeeDto>, // res JSON
  CreateEmpleadoDto, // req.body (DTO SIN foto ni cv)
  {} // query
> = async (req, res, next) => {
  try {
    // 1) Extraer y validar JSON del campo `empleado`
    const body = parseEmpleadoBody<CreateEmpleadoDto>(req);
    const parsed = createEmpleadoSchema.safeParse(body);
    if (!parsed.success) {
      const resp400: ApiResponse<EmployeeDto> = {
        success: false,
        message: "Errores de validación",
        data: null as any,
        errors: parsed.error.issues.map((issue) => ({
          field: issue.path.join(".") || "_",
          message: issue.message,
        })),
      };
      return res.status(400).json(resp400);
    }

    // 2) Archivos (opcionales) desde form-data
    const { foto, cv } = getFiles(req);

    // 3) Delegar a Service (genera código, crea, mueve archivos y guarda filenames)
    const dto = await EmpleadoService.createWithFiles(parsed.data, {
      foto,
      cv,
    });

    // 4) Responder OK
    const resp201: ApiResponse<EmployeeDto> = {
      success: true,
      message: "Empleado creado correctamente",
      data: dto,
    };
    return res.status(201).json(resp201);
  } catch (err: any) {
    // Si el error es por JSON inválido en `empleado`
    if (
      err instanceof Error &&
      /JSON inválido|Body inválido/.test(err.message)
    ) {
      return res.status(400).json({
        success: false,
        message: err.message,
        data: null,
      } as ApiResponse<EmployeeDto>);
    }
    next(err);
  }
};

// -----------------------------------------------------------------------------
// UPDATE (con archivos). Guardado/borrado en servidor lo maneja EmpleadoService.
// -----------------------------------------------------------------------------
export const updateEmpleado: RequestHandler<
  {}, // params
  ApiResponse<EmployeeDto>, // response
  UpdateEmpleadoDto, // body (DTO SIN foto ni cv)
  {} // query
> = async (req, res, next) => {
  try {
    console.log("Actualizar empleado");

    // 1) Extraer y validar JSON del campo `empleado`
    const body = parseEmpleadoBody<UpdateEmpleadoDto>(req);
    console.log("Body recibido:", body);
    const parsed = updateEmpleadoSchema.safeParse(body);
    console.log("Validación:", parsed);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Errores de validación",
        data: null,
        errors: parsed.error.issues.map((issue) => ({
          field: issue.path.join(".") || "_",
          message: issue.message,
        })),
      } as ApiResponse<EmployeeDto>);
    }

    // 2) Archivos (opcionales)
    const { foto, cv } = getFiles(req);

    // 3) Delegar a Service (actualiza campos normales y reemplaza archivos si vienen)
    const dto = await EmpleadoService.updateWithFiles(parsed.data, {
      foto,
      cv,
    });

    // 4) Responder
    return res.status(200).json({
      success: true,
      message: "Empleado actualizado correctamente",
      data: dto,
    } as ApiResponse<EmployeeDto>);
  } catch (err: any) {
    if (
      err instanceof Error &&
      /JSON inválido|Body inválido/.test(err.message)
    ) {
      return res.status(400).json({
        success: false,
        message: err.message,
        data: null,
      } as ApiResponse<EmployeeDto>);
    }
    next(err);
  }
};

// -----------------------------------------------------------------------------
// LIST BY DEPARTMENT (sin cambios; Service retorna URLs públicas construidas)
// -----------------------------------------------------------------------------
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
      } as ApiResponse<EmployeeDto[]>);
    }

    const empleados = await EmpleadoService.getByDepartment(
      user.departamentoId
    );

    return res.json({
      success: true,
      message: "Empleados de tu departamento",
      data: empleados,
    } as ApiResponse<EmployeeDto[]>);
  } catch (err) {
    next(err);
  }
};

// -----------------------------------------------------------------------------
// GET BY ID
// -----------------------------------------------------------------------------
export const getById: RequestHandler<
  { id: string }, // params
  ApiResponse<EmployeeDetailDto>, // response
  {}, // body
  {} // query
> = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const empleado = await EmpleadoService.getById(id);

    if (!empleado) {
      return res.status(404).json({
        success: false,
        message: "Empleado no encontrado",
        data: null,
      } as ApiResponse<EmployeeDetailDto>);
    }

    // Convertir a DTO completo con todos los campos
    const dto = EmpleadoService.toDtoDetail(empleado);

    return res.json({
      success: true,
      message: "Empleado obtenido exitosamente",
      data: dto,
    } as ApiResponse<EmployeeDetailDto>);
  } catch (err) {
    next(err);
  }
};

// -----------------------------------------------------------------------------
// LIST BY COMPANY (sin cambios; Service retorna URLs públicas construidas)
// -----------------------------------------------------------------------------
export const listByCompany: RequestHandler<
  {}, // params
  ApiResponse<EmployeeDto[]>, // response
  {}, // body
  { empresaId?: string } // query
> = async (req, res, next) => {
  try {
    const user = (req as AuthRequest).user;

    // Pueden usar esta ruta: supervisores, rrhh, gerentes y contabilidad
    const allowedRoles = [2, 3, 4, 5];

    if (!allowedRoles.includes(user.rolId)) {
      return res.status(403).json({
        success: false,
        message: "Solo personal de RRHH puede acceder a esta funcionalidad",
        data: [],
      } as ApiResponse<EmployeeDto[]>);
    }

    // Si se proporciona un ID de empresa, usarlo; de lo contrario, obtener todos
    const empresaId = req.query.empresaId
      ? parseInt(req.query.empresaId, 10)
      : undefined;

    if (req.query.empresaId && isNaN(empresaId!)) {
      return res.status(400).json({
        success: false,
        message: "ID de empresa inválido",
        data: [],
      } as ApiResponse<EmployeeDto[]>);
    }

    const empleados = await EmpleadoService.getByCompany(empresaId);

    return res.json({
      success: true,
      message: "Empleados por empresa",
      data: empleados,
    } as ApiResponse<EmployeeDto[]>);
  } catch (err) {
    next(err);
  }
};
