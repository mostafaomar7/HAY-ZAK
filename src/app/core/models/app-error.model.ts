/** Normalized error produced by the error interceptor. */
export interface AppError {
  status: number;
  message: string;
  errors?: Record<string, string[]>;
  url?: string;
  timestamp: string;
}
