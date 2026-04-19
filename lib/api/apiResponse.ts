export type ApiSuccess<T> = {
  success: true;
  data: T;
  message: string;
  meta?: unknown;
};

export type ApiError = {
  success: false;
  error: {
    statusCode: number;
    errorCode: string;
    message: string;
    details?: unknown;
  };
  meta?: unknown;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
