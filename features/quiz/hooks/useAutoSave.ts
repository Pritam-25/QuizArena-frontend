import { useCallback, useEffect, useRef } from 'react';
import {
  useQuizDraftStore,
  type OptionDraft,
  QuestionType,
} from '../store/useQuizDraftStore';
import { useAutosaveQueueStore } from '../store/useAutosaveQueueStore';

const DEBOUNCE_MS = 2000;

/**
 * useAutoSave
 *
 * Handles debounced batch autosave for quiz questions and options.
 * Instead of calling APIs directly, it pushes items to the queue.
 * The queue worker processes items in order with retry logic.
 */
export function useAutoSave(quizId: string) {
  const markOptionSaving = useQuizDraftStore(state => state.markOptionSaving);

  const addToQueue = useAutosaveQueueStore(state => state.addToQueue);

  // Track pending saves - Map holds the in-flight promise to serialize per-question saves
  const pendingQuestionSaves = useRef<Map<string, Promise<void>>>(new Map());
  const debounceTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const executeSaveWithSerializationRef = useRef<
    ((questionId: string) => Promise<void>) | null
  >(null);

  /**
   * Queue options for saving (handles both CREATE new and UPDATE existing)
   */
  const queueOptions = useCallback(
    (questionId: string) => {
      const question = useQuizDraftStore.getState().questions[questionId];
      if (!question) return;

      const allOptions = Object.values(question.options);

      // Split: new options (temp IDs) vs existing options (real IDs)
      // Only include new options that have content, are not being saved,
      // and have not already been created on the backend (idempotency guard).
      const { isEntityCreated } = useAutosaveQueueStore.getState();
      const newOptions = allOptions.filter(
        opt =>
          opt.id.startsWith('temp_') &&
          opt.optionText.trim() &&
          !opt.isSaving &&
          !isEntityCreated(opt.id)
      );

      const dirtyOptions = allOptions.filter(
        opt => opt.isDirty && !opt.id.startsWith('temp_') && !opt.isSaving // prevent queuing UPDATE while a CREATE is still in-flight
      ) as Array<OptionDraft & { id: string }>;

      // Nothing to save
      if (newOptions.length === 0 && dirtyOptions.length === 0) return;

      // CREATE new options - queue them
      if (newOptions.length > 0) {
        console.log(
          `[queueOptions] Found ${newOptions.length} new options to queue:`,
          newOptions.map(o => ({ id: o.id, text: o.optionText }))
        );
        // Mark options as saving before queueing
        newOptions.forEach(opt => {
          markOptionSaving(questionId, opt.id, true);
        });

        newOptions.forEach(opt => {
          addToQueue({
            id: crypto.randomUUID(),
            type: 'CREATE_OPTION',
            entityId: opt.id,
            clientId: opt.id, // Use temp ID as stable clientId
            questionId,
            quizId,
            payload: {
              optionText: opt.optionText,
              isCorrect: opt.isCorrect,
            },
            status: 'pending',
            attempts: 0,
            createdAt: Date.now(),
          });
        });
        console.log(
          `[queueOptions] Queue after adding:`,
          useAutosaveQueueStore.getState().queue.length,
          'items'
        );
      }

      // UPDATE existing options - queue them (batch by grouping into single item)
      if (dirtyOptions.length > 0) {
        dirtyOptions.forEach(opt => {
          addToQueue({
            id: crypto.randomUUID(),
            type: 'UPDATE_OPTION',
            entityId: opt.id,
            clientId: opt.id, // Use real ID as clientId for existing options
            questionId,
            quizId,
            payload: {
              optionText: opt.optionText,
              isCorrect: opt.isCorrect,
            },
            status: 'pending',
            attempts: 0,
            createdAt: Date.now(),
          });
        });
      }
    },
    [addToQueue, markOptionSaving, quizId]
  );

  /**
   * Queue a single question for saving (CREATE or UPDATE)
   */
  const queueQuestion = useCallback(
    (questionId: string) => {
      const question = useQuizDraftStore.getState().questions[questionId];
      if (!question) return;

      const isTemp = question.id.startsWith('temp_');

      if (isTemp) {
        // CREATE new question - queue it
        const payload = {
          questionText: question.questionText || '',
          type: QuestionType[question.type] || 'MCQ',
          points: question.points,
          timeLimit: question.timeLimit,
        };

        addToQueue({
          id: crypto.randomUUID(),
          type: 'CREATE_QUESTION',
          entityId: questionId,
          clientId: questionId, // Use temp ID as stable clientId
          questionId,
          quizId,
          payload,
          status: 'pending',
          attempts: 0,
          createdAt: Date.now(),
        });

        // Queue options separately (they'll be processed after question)
        queueOptions(questionId);
      } else {
        // UPDATE existing question - queue if dirty
        if (question.isDirty) {
          const payload = {
            id: questionId,
            questionText: question.questionText || '',
            points: question.points,
            timeLimit: question.timeLimit,
          };

          addToQueue({
            id: crypto.randomUUID(),
            type: 'UPDATE_QUESTION',
            entityId: questionId,
            clientId: questionId, // Use real ID as clientId for existing questions
            questionId,
            quizId,
            payload,
            status: 'pending',
            attempts: 0,
            createdAt: Date.now(),
          });
        }

        // Always queue dirty options (they have their own isDirty tracking)
        queueOptions(questionId);
      }
    },
    [addToQueue, queueOptions, quizId]
  );

  /**
   * Execute a question save with serialization to prevent concurrent saves
   */
  const executeSaveWithSerialization = useCallback(
    async (questionId: string) => {
      const existingSave = pendingQuestionSaves.current.get(questionId);
      if (existingSave) {
        // A save is in-flight - wait for it, then chain this save
        await existingSave;
        // After the in-flight save completes, check if there are more queued saves
        // and process them by re-queuing this request
        await executeSaveWithSerializationRef.current?.(questionId);
        return;
      }

      // No in-flight save - start a new one
      const savePromise = (async () => {
        queueQuestion(questionId);
      })().finally(() => {
        pendingQuestionSaves.current.delete(questionId);
      });

      pendingQuestionSaves.current.set(questionId, savePromise);
      await savePromise;
    },
    [queueQuestion]
  );

  // Assign the function to the ref so it can call itself recursively
  useEffect(() => {
    executeSaveWithSerializationRef.current = executeSaveWithSerialization;
  }, [executeSaveWithSerialization]);

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
        executeSaveWithSerialization(questionId);
      }, DEBOUNCE_MS);

      debounceTimers.current.set(questionId, timer);
    },
    [executeSaveWithSerialization]
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

      await executeSaveWithSerialization(questionId);
    },
    [executeSaveWithSerialization]
  );

  // Cleanup timers on unmount
  useEffect(() => {
    const timers = debounceTimers.current;
    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, []);

  return { scheduleAutoSave, triggerImmediateSave };
}
