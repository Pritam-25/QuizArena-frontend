import { useEffect, useMemo } from 'react';
import { useQuizDraftStore } from '../store/useQuizDraftStore';
import { useAutosaveQueueStore } from '../store/useAutosaveQueueStore';

/**
 * useQuestionAutosaveTrigger
 *
 * Extracted autosave effect logic from QuestionEditor.
 * Watches granular slices of Zustand state (isDirty, isSaving, options map)
 * instead of the whole question object, so effects only re-fire when the
 * specific flags that gate autosave scheduling actually change.
 *
 * Queue-check guard: before calling scheduleAutoSave we verify there is no
 * pending/processing item for this question already in the queue. This prevents
 * the cascade where reconcileOptionId / markOptionSaved writes trigger a fresh
 * scheduleAutoSave call that re-queues already-in-flight work.
 */
export function useQuestionAutosaveTrigger(
  questionId: string,
  scheduleAutoSave: (id: string) => void
) {
  // Granular subscriptions — each re-renders independently
  const isDirty = useQuizDraftStore(
    state => state.questions[questionId]?.isDirty ?? false
  );
  const isSaving = useQuizDraftStore(
    state => state.questions[questionId]?.isSaving ?? false
  );
  const optionsMap = useQuizDraftStore(
    state => state.questions[questionId]?.options
  );

  // Derive dirty/saving flags from the options map — memoised so effects only
  // re-fire when the derived boolean actually flips, not on every render.
  const hasDirtyOption = useMemo(
    () => (optionsMap ? Object.values(optionsMap).some(o => o.isDirty) : false),
    [optionsMap]
  );

  const hasOptionSaveInFlight = useMemo(
    () =>
      optionsMap ? Object.values(optionsMap).some(o => o.isSaving) : false,
    [optionsMap]
  );

  /**
   * Check at call-time whether this question already has a pending or
   * processing item in the queue.  We intentionally read getState() here
   * (not a hook subscription) so the guard is always fresh without
   * creating an additional reactive dependency.
   */
  const hasPendingQueueItem = () =>
    useAutosaveQueueStore
      .getState()
      .queue.some(
        q =>
          q.questionId === questionId &&
          (q.status === 'pending' || q.status === 'processing')
      );

  // Trigger autosave when question itself becomes dirty
  useEffect(() => {
    if (isDirty && !isSaving && !hasPendingQueueItem()) {
      scheduleAutoSave(questionId);
    }
    // hasPendingQueueItem is a stable function reference defined in this scope —
    // ESLint exhaustive-deps does not need it in the array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty, isSaving, questionId, scheduleAutoSave]);

  // Trigger autosave when any option becomes dirty (separate from question dirty)
  useEffect(() => {
    if (
      hasDirtyOption &&
      !hasOptionSaveInFlight &&
      !isSaving &&
      !hasPendingQueueItem()
    ) {
      scheduleAutoSave(questionId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hasDirtyOption,
    hasOptionSaveInFlight,
    isSaving,
    questionId,
    scheduleAutoSave,
  ]);
}
