import { QueryClient, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiSuccess } from "./apiResponse";

/**
 * Prefill cache config
 */
type SetDataConfig<TData> = {
  key: (data: TData) => readonly unknown[];
};

/**
 * Mutation factory config
 */
type MutationConfig<TData> = {
  successMessage?: string;

  /**
   * Prefill cache (setQueryData)
   */
  setData?: SetDataConfig<TData>[];

  /**
   * Invalidate queries
   */
  invalidate?: (() => readonly unknown[])[];
};

/**
 * useAppMutation
 *
 * @description
 * Centralized mutation success handler:
 * - toast
 * - cache prefill
 * - cache invalidation
 */
export function createMutationHandler<TData>(
  queryClient: QueryClient,
  config?: MutationConfig<TData>,
) {
  return (res: ApiSuccess<TData>) => {
    const { data, message } = res;

    /**
     *  Toast
     */
    if (config?.successMessage || message) {
      toast.success(config?.successMessage ?? message);
    }

    /**
     *  Prefill cache (setQueryData)
     */
    config?.setData?.forEach(({ key }) => {
      queryClient.setQueryData<ApiSuccess<TData>>(key(data), {
        success: true,
        message,
        data,
      });
    });

    /**
     *  Invalidate queries
     */
    config?.invalidate?.forEach((getKey) => {
      queryClient.invalidateQueries({
        queryKey: getKey(),
      });
    });
  };
}
