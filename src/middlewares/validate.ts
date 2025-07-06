// src/middlewares/validate.ts
import { NextFunction, Request, Response } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ApiResponse } from '../dtos/ApiResponse';

export function validate(schema: ZodSchema<any>) {
  return (req: Request, res: Response<ApiResponse<null>>, next: NextFunction) => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        // Mapear cada issue a { field, message }, y quitar el prefijo "body" si existe
        const errors = err.issues.map((issue) => {
          // issue.path = ['body','correo'] o ['body','password']...
          const path = issue.path;
          const field = path[0] === 'body' ? path.slice(1).join('.') : path.join('.');
          return { field, message: issue.message };
        });

        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          data: null,
          errors,         // aquí el array de errores detallados
        });
      }
      next(err);
    }
  };
}
