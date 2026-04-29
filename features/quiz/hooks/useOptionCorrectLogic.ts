import { useCallback } from 'react';
import {
  useQuizDraftStore,
  type OptionDraft,
} from '../store/useQuizDraftStore';

/**
 * useOptionCorrectLogic
 *
 * Handles single-correct-answer constraint for quiz options.
 * When an option is marked correct, all other options in the same question are unset.
 */
export function useOptionCorrectLogic() {
  const updateOption = useQuizDraftStore(state => state.updateOption);
  const questions = useQuizDraftStore(state => state.questions);

  const setCorrectOption = useCallback(
    (questionId: string, optionId: string, shouldBeCorrect: boolean) => {
      const question = questions[questionId];
      if (!question) return;

      const options = question.options;

      const hasTarget = Object.values(options).some(
        (opt: OptionDraft) => opt.id === optionId
      );
      if (!hasTarget) return;

      if (!shouldBeCorrect) {
        updateOption(questionId, optionId, { isCorrect: false });
        return;
      }

      Object.values(options).forEach((opt: OptionDraft) => {
        if (opt.id !== optionId) {
          updateOption(questionId, opt.id, { isCorrect: false });
        }
      });

      updateOption(questionId, optionId, { isCorrect: true });
    },
    [questions, updateOption]
  );

  return { setCorrectOption };
}
