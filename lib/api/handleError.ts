import { AppError } from './api-error';
import { toast } from 'sonner';

/**
 * Handles all frontend errors (API + network)
 */
export function handleError(error: unknown) {
  if (error instanceof AppError) {
    // Handle auth globally
    if (error.statusCode === 401) {
      toast.error('Session expired. Please login again.');
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }

      return; //  prevent double toast
    }
    toast.error(error.message);
    return;
  }
  toast.error('Something went wrong');
}
