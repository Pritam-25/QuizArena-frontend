import { usePostAuthRegister } from '@/api/auth/auth';
import { handleError } from '@/lib/api/handleError';
import { useRouter } from 'next/navigation';
import { useMutationHandler } from '@/lib/api/useMutationHandler';
import { queryKeys } from '@/lib/api/keys';
import { PostAuthRegister201Data } from '@/api/model';

export function useRegister() {
  const router = useRouter();

  const handleSuccess = useMutationHandler<PostAuthRegister201Data>({
    successMessage: 'Registration successful',
    setData: [
      {
        key: () => queryKeys.auth.me(),
      },
    ],
  });

  return usePostAuthRegister({
    mutation: {
      onSuccess: res => {
        handleSuccess(res);
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
