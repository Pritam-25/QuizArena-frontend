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

  /**
   * Set an option as correct, unsetting all others in the same question
   *
   * @param questionId - The question containing the options
   * @param optionId - The option to mark as correct
   * @param shouldBeCorrect - Whether this option should be marked correct
   */
  const setCorrectOption = useCallback(
    (questionId: string, optionId: string, shouldBeCorrect: boolean) => {
      const question = questions[questionId];
      if (!question) return;

      const options = question.options;

      // If unchecking, just update this option
      if (!shouldBeCorrect) {
        updateOption(questionId, optionId, { isCorrect: false });
        return;
      }

      // If checking, unset all others first, then set this one
      // This ensures only ONE option is correct at any time
      Object.values(options).forEach((opt: OptionDraft) => {
        if (opt.id !== optionId) {
          updateOption(questionId, opt.id, { isCorrect: false });
        }
      });

      // Mark the selected option as correct
      updateOption(questionId, optionId, { isCorrect: true });
    },
    [questions, updateOption]
  );

  return { setCorrectOption };
}
