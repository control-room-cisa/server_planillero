export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T | null;
  errors?: { field: string; message: string }[];
}
