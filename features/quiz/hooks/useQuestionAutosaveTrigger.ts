import { useEffect, useMemo, useRef } from 'react';
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
 *
 * BATCHING: Uses a single ref to track if autosave has been scheduled for the
 * current "batch" of changes. Multiple rapid updates (e.g., toggling isCorrect
 * which updates multiple options) will only trigger ONE autosave call.
 */
export function useQuestionAutosaveTrigger(
  questionId: string,
  scheduleAutoSave: (id: string) => void
) {
  // Track if we've already scheduled autosave for this batch of changes
  const scheduledRef = useRef(false);
  const scheduleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Single unified effect for both question and option changes
  // This prevents multiple triggers when multiple updates happen in the same batch
  useEffect(() => {
    // Reset the scheduled flag when there's no dirty state
    if (!isDirty && !hasDirtyOption) {
      scheduledRef.current = false;
      return;
    }

    // Don't schedule if already scheduled for this batch
    if (scheduledRef.current) {
      return;
    }

    // Don't schedule if currently saving
    if (isSaving || hasOptionSaveInFlight) {
      return;
    }

    // Don't schedule if there's already a pending queue item
    if (hasPendingQueueItem()) {
      return;
    }

    // Mark as scheduled and schedule autosave
    scheduledRef.current = true;

    // Clear any existing timeout
    if (scheduleTimeoutRef.current) {
      clearTimeout(scheduleTimeoutRef.current);
    }

    // Use a micro-delay to batch multiple rapid updates together
    scheduleTimeoutRef.current = setTimeout(() => {
      scheduledRef.current = false;
      scheduleAutoSave(questionId);
    }, 50); // 50ms batching window
  }, [
    isDirty,
    hasDirtyOption,
    isSaving,
    hasOptionSaveInFlight,
    questionId,
    scheduleAutoSave,
  ]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scheduleTimeoutRef.current) {
        clearTimeout(scheduleTimeoutRef.current);
      }
    };
  }, []);
}
