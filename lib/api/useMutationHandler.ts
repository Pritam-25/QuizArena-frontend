import { useQueryClient } from '@tanstack/react-query';
import { createMutationHandler } from './createMutationHandler';

export function useMutationHandler<TData, TVariables = unknown>(
  config?: Parameters<typeof createMutationHandler<TData, TVariables>>[1]
) {
  const queryClient = useQueryClient();

  return createMutationHandler<TData, TVariables>(queryClient, config);
}
