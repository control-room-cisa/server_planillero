import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../dtos/ApiResponse';
import { AppError } from '../errors/AppError';

export function errorHandler(
  err: any,
  req: Request,
  res: Response<ApiResponse<null>>,
  next: NextFunction
) {
  const requestId =
    (res.locals as any)?.requestId || (req as any)?.requestId || undefined;

  // Determinar status code
  const statusCode =
    err instanceof AppError
      ? err.statusCode
      : err?.statusCode || err?.status || 500;

  // Extraer validationErrors si existen
  const validationErrors = err?.validationErrors
    ? {
        fechasNoAprobadas: Array.isArray(err.validationErrors.fechasNoAprobadas)
          ? err.validationErrors.fechasNoAprobadas
          : undefined,
        fechasSinRegistro: Array.isArray(err.validationErrors.fechasSinRegistro)
          ? err.validationErrors.fechasSinRegistro
          : undefined,
        ...Object.keys(err.validationErrors).reduce((acc, key) => {
          if (
            key !== "fechasNoAprobadas" &&
            key !== "fechasSinRegistro" &&
            Array.isArray(err.validationErrors[key])
          ) {
            acc[key] = err.validationErrors[key];
          }
          return acc;
        }, {} as Record<string, string[]>),
      }
    : undefined;

  // Normalizar errores a formato estructurado
  const errors: { field: string; message: string }[] = [];
  if (Array.isArray(err?.errors)) {
    errors.push(...err.errors);
  } else if (typeof err?.message === "string") {
    errors.push({ field: "general", message: err.message });
  } else {
    errors.push({ field: "general", message: "Error desconocido" });
  }

  const response: ApiResponse<null> = {
    success: false,
    message: err?.message || "Error desconocido",
    data: null,
    errors: errors.length > 0 ? errors : undefined,
    validationErrors,
  };

  // Ensure correlation id is returned even on error
  if (requestId && !res.getHeader("X-Request-Id")) {
    res.setHeader("X-Request-Id", requestId);
  }

  // Log error details for production debugging (do not leak stack to client)
  // eslint-disable-next-line no-console
  console.error(
    JSON.stringify({
      level: "error",
      msg: "http_error",
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode,
      errorMessage: err?.message,
      errorName: err?.name,
      stack: err?.stack,
      validationErrors,
      errorsCount: Array.isArray(err?.errors) ? err.errors.length : undefined,
    })
  );

  res.status(statusCode).json(response);
}
