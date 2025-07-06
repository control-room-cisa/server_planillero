import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../dtos/ApiResponse';

export function errorHandler(
  err: any,
  req: Request,
  res: Response<ApiResponse<null>>,
  next: NextFunction
) {
  // console.error(err);
  res.status(400).json({
    success: false,
    message: err.message || 'Error desconocido',
    data: null
  });
}
