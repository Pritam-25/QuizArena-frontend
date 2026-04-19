import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * Generic API response shape
 */
type ApiResponse<TData> = {
  message?: string;
  data: TData;
};

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
export function useAppMutation<TData>(config?: MutationConfig<TData>) {
  const queryClient = useQueryClient();

  return {
    onSuccess: (res: ApiResponse<TData>) => {
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
        queryClient.setQueryData<ApiResponse<TData>>(key(data), {
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
    },
  };
}
