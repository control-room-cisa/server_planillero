export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  errors?: { field: string; message: string }[];
}
