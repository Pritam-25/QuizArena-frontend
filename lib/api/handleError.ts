import { AppError } from "./api-error";
import { toast } from "sonner";
import { redirect } from "next/navigation";

/**
 * Handles all frontend errors (API + network)
 */
export function handleError(error: unknown) {
  if (error instanceof AppError) {
    // Handle auth globally
    if (error.statusCode === 401) {
      toast.error("Session expired. Please login again.");
      redirect("/login");
    }
    toast.error(error.message);
    return;
  }
  toast.error("Something went wrong");
}
