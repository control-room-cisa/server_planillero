export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T | null;
  errors?: { field: string; message: string }[];
}
