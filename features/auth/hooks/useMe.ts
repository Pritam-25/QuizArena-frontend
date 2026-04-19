import { getGetAuthMeQueryKey, useGetAuthMe } from '@/api/auth/auth';

export function useMe() {
  return useGetAuthMe({
    query: {
      queryKey: getGetAuthMeQueryKey(),
      staleTime: 10 * 60 * 1000, // 10 min cache
    },
  });
}
