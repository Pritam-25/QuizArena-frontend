import { useMutationHandler } from '@/lib/api/useMutationHandler';
import {
  getGetQuizzesIdQueryKey,
  usePostQuizzesQuestionsQuestionIdOptions,
} from '@/api/quiz/quiz';
import { PostQuizzesQuestionsQuestionIdOptions201Data } from '@/api/model';
import type { PostQuizzesQuestionsQuestionIdOptionsBodyItem } from '@/api/model';

/**
 * Variables type (matches Orval mutation)
 */
type AddOptionsVariables = {
  questionId: string;
  data: PostQuizzesQuestionsQuestionIdOptionsBodyItem[];
};

/**
 * useAddOptions
 *
 * Handles adding options to a question.
 * Invalidates quiz detail cache.
 */
export function useAddOptions() {
  const handleSuccess = useMutationHandler<
    PostQuizzesQuestionsQuestionIdOptions201Data,
    AddOptionsVariables
  >({
    successMessage: 'Options added',

    invalidate: [
      ({ variables }) => getGetQuizzesIdQueryKey(variables.questionId),
    ],
  });

  return usePostQuizzesQuestionsQuestionIdOptions({
    mutation: {
      onSuccess: (res, variables) => {
        handleSuccess(res, variables);
      },
    },
  });
}
