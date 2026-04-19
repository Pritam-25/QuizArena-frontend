import { usePostAuthRegister } from '@/api/auth/auth';
import { handleError } from '@/lib/api/handleError';
import { useRouter } from 'next/navigation';
import { useAppMutation } from '@/lib/api/mutation-factory';
import { queryKeys } from '@/lib/api/keys';

export function useRegister() {
  const router = useRouter();

  return usePostAuthRegister({
    mutation: {
      ...useAppMutation({
        successMessage: 'Account created successfully',

        setData: [
          {
            key: () => queryKeys.auth.me(),
          },
        ],
      }),

      onSuccess: () => {
        router.replace('/');
      },

      /**
       * Triggered when registration API fails
       */
      onError: handleError,
    },
  });
}

/**
 * useRegister Hook (alternate approach)
 */

/*
export function useRegister() {
  const router = useRouter();
  const setMe = useSetGetAuthMeQueryData();

  return usePostAuthRegister({
    mutation: {
      onSuccess: ({ data, message }) => {
        toast.success(message || 'Registration successful');

        // update auth cache with new user data
        setMe({
          success: true,
          message,
          data,
        });

        // redirect to home
        router.replace('/');
      },
      onError: handleError,
    },
  });
}
*/
