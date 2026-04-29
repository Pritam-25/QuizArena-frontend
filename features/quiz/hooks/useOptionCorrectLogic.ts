import { useCallback } from 'react';
import { useQuizDraftStore } from '../store/useQuizDraftStore';

/**
 * useOptionCorrectLogic
 *
 * Handles single-correct-answer constraint for quiz options.
 * When an option is marked correct, all other options in the same question are unset.
 *
 * Uses getState() for reading inside the callback instead of subscribing to the
 * entire questions map — this prevents re-renders from unrelated question/option changes.
 */
export function useOptionCorrectLogic() {
  const updateOption = useQuizDraftStore(state => state.updateOption);

  const setCorrectOption = useCallback(
    (questionId: string, optionId: string, shouldBeCorrect: boolean) => {
      // Read fresh state at call-time — no subscription needed
      const question = useQuizDraftStore.getState().questions[questionId];
      if (!question) return;

      const options = question.options;

      const hasTarget = Object.values(options).some(opt => opt.id === optionId);
      if (!hasTarget) return;

      if (!shouldBeCorrect) {
        updateOption(questionId, optionId, { isCorrect: false });
        return;
      }

      Object.values(options).forEach(opt => {
        if (opt.id !== optionId) {
          updateOption(questionId, opt.id, { isCorrect: false });
        }
      });

      updateOption(questionId, optionId, { isCorrect: true });
    },
    [updateOption] // no longer depends on 'questions'
  );

  return { setCorrectOption };
}
