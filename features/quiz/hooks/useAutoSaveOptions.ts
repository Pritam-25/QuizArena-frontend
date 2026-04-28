import { useCallback, useEffect, useRef } from 'react';
import {
  useQuizDraftStore,
  type OptionDraft,
} from '../store/useQuizDraftStore';
import {
  usePatchQuizzesOptionsBulk,
  usePostQuizzesQuestionsQuestionIdOptions,
} from '@/api/quiz/quiz';
import type { PatchQuizzesOptionsBulkBodyItem } from '@/api/model/patchQuizzesOptionsBulkBodyItem';

const DEBOUNCE_MS = 1000;

/**
 * useAutoSaveOptions
 *
 * Handles debounced batch autosave for quiz options.
 * Groups option changes by question and sends bulk updates.
 * Handles temp ID → backend ID reconciliation.
 */
export function useAutoSaveOptions() {
  const markSaving = useQuizDraftStore(state => state.markSaving);
  const markSaved = useQuizDraftStore(state => state.markSaved);
  const markError = useQuizDraftStore(state => state.markError);
  const reconcileOptionId = useQuizDraftStore(state => state.reconcileOptionId);

  const { mutateAsync: bulkUpdate } = usePatchQuizzesOptionsBulk();
  const { mutateAsync: createOptions } =
    usePostQuizzesQuestionsQuestionIdOptions();

  // Track pending saves per question
  const pendingSaves = useRef<Set<string>>(new Set());
  const debounceTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  /**
   * Save options for a question (handles both CREATE new and UPDATE existing)
   */
  const saveOptions = useCallback(
    async (questionId: string) => {
      // Always read fresh state from store (not stale closure)
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

      // Mark as saving
      markSaving([questionId]);
      pendingSaves.current.add(questionId);

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

          await bulkUpdate({ data: payload });
        }

        markSaved([questionId]);
      } catch {
        markError([questionId]);
      } finally {
        pendingSaves.current.delete(questionId);
      }
    },
    [
      markSaving,
      markSaved,
      markError,
      createOptions,
      bulkUpdate,
      reconcileOptionId,
    ]
  );

  /**
   * Collect dirty options for a question and schedule autosave
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
        saveOptions(questionId);
      }, DEBOUNCE_MS);

      debounceTimers.current.set(questionId, timer);
    },
    [saveOptions]
  );

  /**
   * Trigger immediate save for a question (e.g., when correct answer changes)
   */
  const triggerImmediateSave = useCallback(
    async (questionId: string) => {
      // Clear existing timer
      const existingTimer = debounceTimers.current.get(questionId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      await saveOptions(questionId);
    },
    [saveOptions]
  );

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      debounceTimers.current.forEach(timer => clearTimeout(timer));
    };
  }, []);

  return { scheduleAutoSave, triggerImmediateSave };
}
