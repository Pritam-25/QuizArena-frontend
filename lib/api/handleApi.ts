import { AppError } from "./api-error";

/**
 * Handles API response and throws AppError if failed
 * Returns { data, message } on success
 */
export function handleApiResponse<T>(res: any): { data: T; message: string } {
  if (res?.success === true) {
    return {
      data: res.data as T,
      message: res.message,
    };
  }
  const err = res?.error;
  throw new AppError({
    message: err?.message || "Something went wrong",
    statusCode: err?.statusCode || 500,
    errorCode: err?.errorCode || "UNKNOWN_ERROR",
    details: err?.details,
  });
}
