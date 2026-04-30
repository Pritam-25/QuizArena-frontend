import { useCallback, useEffect, useRef } from 'react';
import {
  useQuizDraftStore,
  type OptionDraft,
  QuestionType,
} from '../store/useQuizDraftStore';
import { useAutosaveQueueStore } from '../store/useAutosaveQueueStore';

const QUESTION_DEBOUNCE_MS = 2000;
const OPTION_DEBOUNCE_MS = 500; // Options debounce faster for snappier UX

/**
 * useAutoSave
 *
 * Handles debounced batch autosave for quiz questions and options.
 * Instead of calling APIs directly, it pushes items to the queue.
 * The queue worker processes items in order with retry logic.
 *
 * ARCHITECTURE:
 * - Questions: debounced save per question
 * - Options: debounced save per question (batched)
 * - New options (temp_id) trigger CREATE_OPTION immediately
 * - Existing options trigger UPDATE_OPTION
 */
export function useAutoSave(quizId: string) {
  const markOptionSaving = useQuizDraftStore(state => state.markOptionSaving);
  const addToQueue = useAutosaveQueueStore(state => state.addToQueue);

  // Track pending saves - Map holds the in-flight promise to serialize per-question saves
  const pendingQuestionSaves = useRef<Map<string, Promise<void>>>(new Map());
  const questionDebounceTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const optionDebounceTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const executeSaveWithSerializationRef = useRef<
    ((questionId: string) => Promise<void>) | null
  >(null);

  /**
   * Queue options for saving (handles both CREATE new and UPDATE existing)
   * Called by both question autosave and option-level autosave
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

        const now = Date.now();
        newOptions.forEach(opt => {
          addToQueue({
            id: crypto.randomUUID(),
            type: 'CREATE_OPTION',
            entityId: opt.id,
            clientId: opt.id, // Use temp ID as stable clientId
            idempotencyKey: `create_option:${quizId}:${questionId}:${opt.id}:${now}`, // unique idempotency key
            questionId,
            quizId,
            payload: {
              optionText: opt.optionText,
              isCorrect: opt.isCorrect,
            },
            status: 'pending',
            attempts: 0,
            createdAt: now,
            updatedAt: now,
            version: 1,
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
        const now = Date.now();
        dirtyOptions.forEach(opt => {
          addToQueue({
            id: crypto.randomUUID(),
            type: 'UPDATE_OPTION',
            entityId: opt.id,
            clientId: opt.id, // Use real ID as clientId for existing options
            idempotencyKey: `update_option:${quizId}:${opt.id}:${now}`, // unique idempotency key
            questionId,
            quizId,
            payload: {
              optionText: opt.optionText,
              isCorrect: opt.isCorrect,
            },
            status: 'pending',
            attempts: 0,
            createdAt: now,
            updatedAt: now,
            version: 1,
          });
        });
      }
    },
    [addToQueue, markOptionSaving, quizId]
  );

  /**
   * Schedule option autosave for a specific question
   * This is the KEY FIX: options now have their own debounced trigger
   * instead of only being saved when the question changes
   */
  const scheduleOptionSave = useCallback(
    (questionId: string) => {
      // Clear existing timer for this question's options
      const existingTimer = optionDebounceTimers.current.get(questionId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Schedule debounced option save
      const timer = setTimeout(() => {
        queueOptions(questionId);
      }, OPTION_DEBOUNCE_MS);

      optionDebounceTimers.current.set(questionId, timer);
    },
    [queueOptions]
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
        const now = Date.now();
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
          idempotencyKey: `create_question:${quizId}:${questionId}:${now}`, // unique idempotency key
          questionId,
          quizId,
          payload,
          status: 'pending',
          attempts: 0,
          createdAt: now,
          updatedAt: now,
          version: 1,
        });

        // Queue options separately (they'll be processed after question)
        queueOptions(questionId);
      } else {
        // UPDATE existing question - queue if dirty
        if (question.isDirty) {
          const now = Date.now();
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
            idempotencyKey: `update_question:${quizId}:${questionId}:${now}`, // unique idempotency key
            questionId,
            quizId,
            payload,
            status: 'pending',
            attempts: 0,
            createdAt: now,
            updatedAt: now,
            version: 1,
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
   * Schedule autosave for a question (question text/metadata changes)
   */
  const scheduleAutoSave = useCallback(
    (questionId: string) => {
      // Clear existing timer for this question
      const existingTimer = questionDebounceTimers.current.get(questionId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Schedule new debounced save
      const timer = setTimeout(() => {
        executeSaveWithSerialization(questionId);
      }, QUESTION_DEBOUNCE_MS);

      questionDebounceTimers.current.set(questionId, timer);
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

  // Subscribe to option changes and trigger option autosave
  // This is the KEY FIX: directly listen to store changes for options
  useEffect(() => {
    const unsubscribe = useQuizDraftStore.subscribe(
      // Select all option-related state
      state =>
        Object.values(state.questions).flatMap(q =>
          Object.values(q.options).map(opt => ({
            questionId: q.id,
            optionId: opt.id,
            optionText: opt.optionText,
            isCorrect: opt.isCorrect,
            isDirty: opt.isDirty,
            isSaving: opt.isSaving,
          }))
        ),
      // Custom equality check to avoid unnecessary triggers
      (newOptions, oldOptions) => {
        if (newOptions.length !== oldOptions?.length) return false;
        return newOptions.every(
          (opt, i) =>
            opt.optionText === oldOptions[i].optionText &&
            opt.isCorrect === oldOptions[i].isCorrect &&
            opt.isDirty === oldOptions[i].isDirty &&
            opt.isSaving === oldOptions[i].isSaving
        );
      },
      // Callback when options change
      () => {
        // Get all questions that have dirty or new options
        const state = useQuizDraftStore.getState();
        const questionsWithOptionChanges = new Set<string>();

        Object.values(state.questions).forEach(question => {
          const allOptions = Object.values(question.options);
          const { isEntityCreated } = useAutosaveQueueStore.getState();

          const hasNewOptions = allOptions.some(
            opt =>
              opt.id.startsWith('temp_') &&
              opt.optionText.trim() &&
              !opt.isSaving &&
              !isEntityCreated(opt.id)
          );

          const hasDirtyOptions = allOptions.some(
            opt => opt.isDirty && !opt.id.startsWith('temp_') && !opt.isSaving
          );

          if (hasNewOptions || hasDirtyOptions) {
            questionsWithOptionChanges.add(question.id);
          }
        });

        // Trigger option autosave for each affected question
        questionsWithOptionChanges.forEach(questionId => {
          scheduleOptionSave(questionId);
        });
      }
    );

    return () => unsubscribe();
  }, [scheduleOptionSave]);

  // Cleanup timers on unmount
  useEffect(() => {
    const questionTimers = questionDebounceTimers.current;
    const optionTimers = optionDebounceTimers.current;
    return () => {
      questionTimers.forEach(timer => clearTimeout(timer));
      optionTimers.forEach(timer => clearTimeout(timer));
    };
  }, []);

  return { scheduleAutoSave, triggerImmediateSave };
}
