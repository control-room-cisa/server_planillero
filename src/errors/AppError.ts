export class AppError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    // Mantén la pila limpia apuntando aquí
    Error.captureStackTrace(this, this.constructor);
  }
}
