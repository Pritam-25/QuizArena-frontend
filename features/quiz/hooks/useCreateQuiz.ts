import { PostQuizzes201Data } from '@/api/model';
import { getGetQuizzesIdQueryKey, usePostQuizzes } from '@/api/quiz/quiz';

import { queryKeys } from '@/lib/api/keys';
import { useMutationHandler } from '@/lib/api/useMutationHandler';
import { useRouter } from 'next/navigation';

/**
 * useCreateQuiz Hook
 *
 * @description
 * Handles quiz creation using an Orval-generated React Query mutation.
 *
 * This hook is built on top of a custom mutation factory (`useAppMutation`)
 * to centralize:
 * - Success handling (toast notifications)
 * - Cache prefill (setQueryData)
 * - Cache invalidation (query refresh control)
 * - Clean separation of navigation logic
 *
 * @behavior
 * ✅ On Success:
 * - Shows success toast (from API message or fallback message)
 * - Prefills quiz detail cache using `setQueryData`
 *   → Enables instant navigation to quiz page without refetch
 * - Invalidates quiz list cache
 *   → Ensures quiz list stays up to date
 * - Redirects user to quiz detail page

 * ❌ On Error:
 * - Handled globally via React Query / mutation factory (if configured)
 *
 * @performance
 * - Improves UX by preloading quiz detail in cache
 * - Reduces unnecessary network requests
 * - Keeps component logic minimal and declarative
 *
 * @example
 * const { mutate, isPending } = useCreateQuiz();
 *
 * mutate({
 *   data: {
 *     title: "New Quiz"
 *   }
 * });
 *
 * @note
 * - Cache key is derived from `getGetQuizzesIdQueryKey`
 * - List cache is invalidated using `queryKeys.quiz.list()`
 * - Navigation is handled after mutation success
 */

export function useCreateQuiz() {
  const router = useRouter();

  const handleSuccess = useMutationHandler<PostQuizzes201Data>({
    successMessage: 'Quiz created successfully',

    setData: [
      {
        key: data => getGetQuizzesIdQueryKey(data.id),
      },
    ],

    invalidate: [() => queryKeys.quiz.list()],
  });

  return usePostQuizzes({
    mutation: {
      onSuccess: res => {
        const { data: quiz } = res;

        // 1. cache + toast
        handleSuccess(res);

        // 2. navigation (feature responsibility)
        router.replace(`/host/quizzes/${quiz.id}`);
      },
    },
  });
}

/**
 * Alternate approach (without mutation factory)
 *
 * - Shows success toast after quiz creation
 * - Prefills quiz detail cache using setQueryData
 * - Invalidates quiz list cache to keep data fresh
 * - Redirects user to quiz detail page
 *
 * Note:
 * This approach is more verbose and not scalable.
 * Prefer using a mutation factory for large applications.
 */

/*
export function useCreateQuiz() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return usePostQuizzes({
    mutation: {
      onSuccess: ({ data, message }) => {
        toast.success(message || 'Quiz created successfully');

        queryClient.setQueryData(getGetQuizzesIdQueryKey(data.id), {
          success: true,
          message,
          data,
        });

        queryClient.invalidateQueries({
          queryKey: queryKeys.quiz.list(),
        });

        router.replace(`/host/quizzes/${data.id}`);
      },
    },
  });
}
*/
