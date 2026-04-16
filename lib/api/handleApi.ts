import { AppError } from "./api-error";

/**
 * Handles API response and throws AppError if failed
 * Returns { data, message } on success
 */

type ApiErrorPayload = {
  message?: string;
  statusCode?: number;
  errorCode?: string;
  details?: unknown;
};

export type ApiResponse<T> =
  | { success: true; data: T; message?: string }
  | { success?: false; error?: ApiErrorPayload };

export function handleApiResponse<T>(res: ApiResponse<T>): {
  data: T;
  message: string;
} {
  if (res?.success === true) {
    return {
      data: res.data,
      message: res.message ?? "",
    };
  }
  const err = res?.error;
  throw new AppError({
    message: err?.message ?? "Something went wrong",
    statusCode: err?.statusCode ?? 500,
    errorCode: err?.errorCode ?? "UNKNOWN_ERROR",
    details: err?.details,
  });
}
