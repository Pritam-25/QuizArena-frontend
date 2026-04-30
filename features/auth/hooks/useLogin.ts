import { useRouter } from 'next/navigation';
import { usePostAuthLogin } from '@/api/auth/auth';
import { handleError } from '@/lib/api/handleError';
import { useMutationHandler } from '@/lib/api/useMutationHandler';
import { queryKeys } from '@/lib/api/keys';
import { PostAuthLogin200Data } from '@/api/model/postAuthLogin200Data';

/**
 * useLogin
 *
 * @description
 * Custom hook to authenticate a user using the login API.
 *
 * Internally uses an Orval-generated React Query mutation and handles:
 * - API request execution
 * - Success feedback (toast)
 * - React Query cache synchronization (`auth/me`)
 * - Client-side navigation after login
 *
 * @returns React Query mutation object for login
 *
 * @example
 * const { mutate, isPending } = useLogin();
 *
 * mutate({
 *   data: {
 *     email: "user@example.com",
 *     password: "password123"
 *   }
 * });
 *
 * @behavior
 * ✅ On Success:
 * - Shows a success toast using API message (fallback: "Login successful")
 * - Updates the `auth/me` cache using `useSetGetAuthMeQueryData`
 *   → ensures immediate UI sync without refetch
 * - Redirects user to home page (`/`)
 *
 * ❌ On Error:
 * - Delegates error handling to `handleError`
 *   → typically shows error toast and handles auth edge cases (e.g., 401)
 *
 * @notes
 * - Assumes backend response shape:
 *   { success: true, message: string, data: { user: User } }
 * - Cache update MUST match `getAuthMe` response type exactly
 * - No manual query invalidation is needed here (direct cache update is used)
 *
 * @why
 * - Keeps UI components free from business logic
 * - Prevents unnecessary network requests (no refetch after login)
 * - Centralizes authentication flow for maintainability and reuse
 */
export function useLogin() {
  const router = useRouter();

  const handleSuccess = useMutationHandler<PostAuthLogin200Data>({
    successMessage: 'Login successful',
    setData: [
      {
        key: () => queryKeys.auth.me(),
      },
    ],
  });

  return usePostAuthLogin({
    mutation: {
      onSuccess: res => {
        handleSuccess(res);
        router.replace('/');
      },

      /**
       * Triggered when login API fails
       */
      onError: handleError,
    },
  });
}
