import { useQueryClient } from '@tanstack/react-query';
import { createMutationHandler } from './createMutationHandler';

export function useMutationHandler<TData>(
  config?: Parameters<typeof createMutationHandler<TData>>[1]
) {
  const queryClient = useQueryClient();

  return createMutationHandler<TData>(queryClient, config);
}
