import { useMutationHandler } from '@/lib/api/useMutationHandler';
import {
  getGetQuizzesIdQueryKey,
  usePostQuizzesQuizIdQuestions,
} from '@/api/quiz/quiz';
import { PostQuizzesQuizIdQuestions201Data } from '@/api/model';

/**
 * useAddQuestion
 *
 * Handles adding a new question to a quiz.
 * Invalidates quiz detail cache to refetch updated questions.
 */
export function useAddQuestion() {
  const handleSuccess = useMutationHandler<
    PostQuizzesQuizIdQuestions201Data,
    { quizId: string }
  >({
    successMessage: 'Question added',

    invalidate: [({ variables }) => getGetQuizzesIdQueryKey(variables.quizId)],
  });

  return usePostQuizzesQuizIdQuestions({
    mutation: {
      onSuccess: (res, variables) => {
        handleSuccess(res, variables);
      },
    },
  });
}
