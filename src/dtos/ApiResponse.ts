export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T | null;
  errors?: { field: string; message: string }[];
  validationErrors?: {
    fechasNoAprobadas?: string[];
    fechasSinRegistro?: string[];
    [key: string]: string[] | undefined;
  };
}
