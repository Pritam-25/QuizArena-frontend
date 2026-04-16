import { ApiResponse, handleApiResponse } from "./handleApi";
import { handleError } from "./handleError";

/**
 * Wraps mutation success handling
 */
export function handleMutation<T>(
  res: any,
  onSuccess?: (data: T, message?: string) => void,
) {
  try {
    const { data, message } = handleApiResponse<T>(res);
    onSuccess?.(data, message);
  } catch (error) {
    handleError(error);
  }
}
