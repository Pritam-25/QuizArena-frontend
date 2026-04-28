import { useCallback, useEffect, useRef } from 'react';
import {
  useQuizDraftStore,
  type OptionDraft,
  QuestionType,
} from '../store/useQuizDraftStore';
import {
  usePatchQuizzesOptionsBulk,
  usePostQuizzesQuestionsQuestionIdOptions,
  usePostQuizzesQuizIdQuestions,
  usePatchQuizzesQuestionsBulk,
} from '@/api/quiz/quiz';
import type { PatchQuizzesOptionsBulkBodyItem } from '@/api/model/patchQuizzesOptionsBulkBodyItem';
import type { PostQuizzesQuizIdQuestionsBody } from '@/api/model/postQuizzesQuizIdQuestionsBody';
import type { PatchQuizzesQuestionsBulkBodyItem } from '@/api/model/patchQuizzesQuestionsBulkBodyItem';

const DEBOUNCE_MS = 1000;

/**
 * useAutoSave
 *
 * Handles debounced batch autosave for quiz questions and options.
 * Groups changes by entity and sends bulk updates.
 * Handles temp ID → backend ID reconciliation for both questions and options.
 */
export function useAutoSave(quizId: string) {
  const markSaving = useQuizDraftStore(state => state.markSaving);
  const markSaved = useQuizDraftStore(state => state.markSaved);
  const markError = useQuizDraftStore(state => state.markError);
  const reconcileQuestionId = useQuizDraftStore(
    state => state.reconcileQuestionId
  );
  const reconcileOptionId = useQuizDraftStore(state => state.reconcileOptionId);

  // Mutations
  const { mutateAsync: createQuestion } = usePostQuizzesQuizIdQuestions();
  const { mutateAsync: bulkUpdateQuestions } = usePatchQuizzesQuestionsBulk();
  const { mutateAsync: createOptions } =
    usePostQuizzesQuestionsQuestionIdOptions();
  const { mutateAsync: bulkUpdateOptions } = usePatchQuizzesOptionsBulk();

  // Track pending saves
  const pendingQuestionSaves = useRef<Set<string>>(new Set());
  const debounceTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  /**
   * Save options for a question (handles both CREATE new and UPDATE existing)
   */
  const saveOptions = useCallback(
    async (questionId: string) => {
      const question = useQuizDraftStore.getState().questions[questionId];
      if (!question) return;

      const allOptions = Object.values(question.options);

      // Split: new options (temp IDs) vs existing options (real IDs)
      const newOptions = allOptions.filter(
        opt => opt.id.startsWith('temp_') && opt.optionText.trim()
      );

      const dirtyOptions = allOptions.filter(
        opt => opt.isDirty && !opt.id.startsWith('temp_')
      ) as Array<OptionDraft & { id: string }>;

      // Nothing to save
      if (newOptions.length === 0 && dirtyOptions.length === 0) return;

      try {
        // CREATE new options
        if (newOptions.length > 0) {
          const res = await createOptions({
            questionId,
            data: newOptions.map(opt => ({
              optionText: opt.optionText,
              isCorrect: opt.isCorrect,
            })),
          });

          // Reconcile temp IDs with backend IDs (index-based mapping)
          if (Array.isArray(res.data)) {
            res.data.forEach((backendOpt, index) => {
              const tempId = newOptions[index].id;
              reconcileOptionId(questionId, tempId, backendOpt.id);
            });
          }
        }

        // UPDATE existing options
        if (dirtyOptions.length > 0) {
          const payload: PatchQuizzesOptionsBulkBodyItem[] = dirtyOptions.map(
            opt => ({
              id: opt.id,
              optionText: opt.optionText,
              isCorrect: opt.isCorrect,
            })
          );

          await bulkUpdateOptions({ data: payload });
        }
      } catch (error) {
        console.error('Failed to save options:', error);
        throw error; // Re-throw to be caught by question save
      }
    },
    [createOptions, bulkUpdateOptions, reconcileOptionId]
  );

  /**
   * Save a single question (CREATE or UPDATE)
   */
  const saveQuestion = useCallback(
    async (questionId: string) => {
      const question = useQuizDraftStore.getState().questions[questionId];
      if (!question) return;

      const isTemp = question.id.startsWith('temp_');

      // Mark as saving
      markSaving([questionId]);
      pendingQuestionSaves.current.add(questionId);

      try {
        if (isTemp) {
          // CREATE new question
          const payload: PostQuizzesQuizIdQuestionsBody = {
            questionText: question.questionText,
            type: QuestionType[question.type],
            points: question.points,
            timeLimit: question.timeLimit,
          };

          const res = await createQuestion({
            quizId,
            data: payload,
          });

          const realQuestionId = res.data.id;

          // Reconcile question ID
          reconcileQuestionId(questionId, realQuestionId);

          // If question had dirty options, save them too
          await saveOptions(realQuestionId);
        } else {
          // UPDATE existing question
          const payload: PatchQuizzesQuestionsBulkBodyItem = {
            id: questionId,
            questionText: question.questionText,
            points: question.points,
            timeLimit: question.timeLimit,
          };

          await bulkUpdateQuestions({ data: [payload] });

          // If question had dirty options, save them too
          await saveOptions(questionId);
        }

        markSaved([questionId]);
      } catch (error) {
        console.error('Failed to save question:', error);
        markError([questionId]);
      } finally {
        pendingQuestionSaves.current.delete(questionId);
      }
    },
    [
      markSaving,
      markSaved,
      markError,
      createQuestion,
      bulkUpdateQuestions,
      reconcileQuestionId,
      quizId,
      saveOptions,
    ]
  );

  /**
   * Schedule autosave for a question
   */
  const scheduleAutoSave = useCallback(
    (questionId: string) => {
      // Clear existing timer for this question
      const existingTimer = debounceTimers.current.get(questionId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Schedule new debounced save
      const timer = setTimeout(() => {
        saveQuestion(questionId);
      }, DEBOUNCE_MS);

      debounceTimers.current.set(questionId, timer);
    },
    [saveQuestion]
  );

  /**
   * Trigger immediate save for a question
   */
  const triggerImmediateSave = useCallback(
    async (questionId: string) => {
      // Clear existing timer
      const existingTimer = debounceTimers.current.get(questionId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      await saveQuestion(questionId);
    },
    [saveQuestion]
  );

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      debounceTimers.current.forEach(timer => clearTimeout(timer));
    };
  }, []);

  return { scheduleAutoSave, triggerImmediateSave };
}
