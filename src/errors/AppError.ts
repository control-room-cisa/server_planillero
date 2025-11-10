export class AppError extends Error {
  public readonly statusCode: number;
  public readonly validationErrors?: {
    fechasNoAprobadas?: string[];
    fechasSinRegistro?: string[];
    [key: string]: string[] | undefined;
  };

  constructor(
    message: string,
    statusCode = 400,
    validationErrors?: {
      fechasNoAprobadas?: string[];
      fechasSinRegistro?: string[];
      [key: string]: string[] | undefined;
    }
  ) {
    super(message);
    this.statusCode = statusCode;
    this.validationErrors = validationErrors;
    // Mantén la pila limpia apuntando aquí
    Error.captureStackTrace(this, this.constructor);
  }
}
