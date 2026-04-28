import { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiSuccess } from './apiResponse';

/**
 * Prefill cache config
 */
type SetDataConfig<TData> = {
  key: (data: TData) => readonly unknown[];
};

/**
 * Mutation factory config
 */
type MutationConfig<TData, TVariables> = {
  successMessage?: string;

  /**
   * Prefill cache (setQueryData)
   */
  setData?: SetDataConfig<TData>[];

  /**
   * Invalidate queries
   */
  invalidate?: ((args: {
    data: TData;
    variables: TVariables;
  }) => readonly unknown[])[];
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
export function createMutationHandler<TData, TVariables>(
  queryClient: QueryClient,
  config?: MutationConfig<TData, TVariables>
) {
  return (res: ApiSuccess<TData>, variables?: TVariables) => {
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
    config?.invalidate?.forEach(getKey => {
      if (variables) {
        queryClient.invalidateQueries({
          queryKey: getKey({ data, variables }),
        });
      }
    });
  };
}
