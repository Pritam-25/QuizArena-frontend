import { useCallback, useEffect, useRef } from 'react';
import { useAutosaveQueueStore } from '../store/useAutosaveQueueStore';
import {
  usePostQuizzesQuestionsQuestionIdOptions,
  usePatchQuizzesOptionsBulk,
  usePostQuizzesQuizIdQuestions,
  usePatchQuizzesQuestionsBulk,
} from '@/api/quiz/quiz';
import type { QueueItem } from './autosaveQueue';
import { saveItemToIndexedDB, deleteItemFromIndexedDB } from './autosaveQueue';
import { useQuizDraftStore } from '../store/useQuizDraftStore';

const MAX_ATTEMPTS = 3;
const PROCESSING_DELAY = 500; // ms between processing items

/**
 * useQueueWorker
 *
 * Background worker that processes the autosave queue.
 * Runs continuously, processing pending items one at a time.
 * Handles retries with exponential backoff.
 */
export function useQueueWorker() {
  const { updateEntityId, markEntityCreated } = useAutosaveQueueStore();

  // Mutations
  const { mutateAsync: createOptions } =
    usePostQuizzesQuestionsQuestionIdOptions();
  const { mutateAsync: bulkUpdateOptions } = usePatchQuizzesOptionsBulk();
  const { mutateAsync: createQuestion } = usePostQuizzesQuizIdQuestions();
  const { mutateAsync: bulkUpdateQuestions } = usePatchQuizzesQuestionsBulk();

  const reconcileOptionId = useQuizDraftStore(state => state.reconcileOptionId);
  const reconcileQuestionId = useQuizDraftStore(
    state => state.reconcileQuestionId
  );
  const markOptionSaving = useQuizDraftStore(state => state.markOptionSaving);
  const markOptionSaved = useQuizDraftStore(state => state.markOptionSaved);
  const markSaved = useQuizDraftStore(state => state.markSaved);

  const processingRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const executeItem = useCallback(
    async (item: QueueItem): Promise<void> => {
      // Idempotency guard: skip CREATE if entity already created
      if (item.type === 'CREATE_QUESTION' || item.type === 'CREATE_OPTION') {
        const { isEntityCreated } = useAutosaveQueueStore.getState();
        if (isEntityCreated(item.clientId)) {
          console.log(
            `Entity ${item.clientId} already created, skipping ${item.type}`
          );
          return; // Already created, skip
        }
      }

      switch (item.type) {
        case 'CREATE_OPTION': {
          const res = await createOptions({
            questionId: item.questionId,
            data: [item.payload],
          });

          if (res.data && Array.isArray(res.data) && res.data.length > 0) {
            const backendId = res.data[0].id;
            // Update queue with new entity ID
            updateEntityId(item.entityId, backendId);
            reconcileOptionId(item.questionId, item.entityId, backendId);
            // Clear isSaving and isDirty after successful creation
            markOptionSaving(item.questionId, item.entityId, false);
            // Mark entity as created (idempotency guard)
            markEntityCreated(item.clientId);
          }
          break;
        }

        case 'UPDATE_OPTION': {
          await bulkUpdateOptions({
            data: [
              {
                id: item.entityId,
                optionText: item.payload.optionText,
                isCorrect: item.payload.isCorrect,
              },
            ],
          });
          // Clear isDirty after successful update
          markOptionSaved(item.questionId, item.entityId);
          break;
        }

        case 'CREATE_QUESTION': {
          const res = await createQuestion({
            quizId: item.quizId,
            data: item.payload,
          });

          if (res.data?.id) {
            const backendId = res.data.id;
            // Update queue with new entity ID
            updateEntityId(item.entityId, backendId);
            reconcileQuestionId(item.entityId, backendId);
            // Clear isSaving after successful creation
            markSaved([backendId]);
            // Mark entity as created (idempotency guard)
            markEntityCreated(item.clientId);
          }
          break;
        }

        case 'UPDATE_QUESTION': {
          await bulkUpdateQuestions({
            data: [
              {
                id: item.entityId,
                questionText: item.payload.questionText,
                points: item.payload.points,
                timeLimit: item.payload.timeLimit,
              },
            ],
          });
          // Clear isDirty after successful update
          markSaved([item.entityId]);
          break;
        }

        default:
          throw new Error(`Unknown queue item type: ${item.type}`);
      }
    },
    [
      createOptions,
      bulkUpdateOptions,
      createQuestion,
      bulkUpdateQuestions,
      updateEntityId,
      reconcileOptionId,
      reconcileQuestionId,
      markOptionSaving,
      markOptionSaved,
      markSaved,
      markEntityCreated,
    ]
  );

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;

    try {
      const { queue, markProcessing, markSuccess, markFailed } =
        useAutosaveQueueStore.getState();
      // Find first pending item
      const pendingItem = queue.find(q => q.status === 'pending');

      if (!pendingItem) {
        // No pending item, but keep polling
        return;
      }

      // Check if max attempts exceeded
      if (pendingItem.attempts >= MAX_ATTEMPTS) {
        console.error(
          `Max attempts exceeded for item ${pendingItem.id}, dropping`
        );
        markSuccess(pendingItem.id, pendingItem.clientId, pendingItem.type);
        await deleteItemFromIndexedDB(pendingItem.id);
        return;
      }

      markProcessing(pendingItem.id);
      await saveItemToIndexedDB(pendingItem);

      try {
        await executeItem(pendingItem);
        markSuccess(pendingItem.id, pendingItem.clientId, pendingItem.type);
        await deleteItemFromIndexedDB(pendingItem.id);
      } catch (error: unknown) {
        // Handle 409 Conflict - don't retry, just drop
        const err = error as {
          response?: { status?: number };
          message?: string;
        };
        if (err?.response?.status === 409) {
          console.warn(`Conflict error for item ${pendingItem.id}, dropping`);
          markSuccess(pendingItem.id, pendingItem.clientId, pendingItem.type);
          await deleteItemFromIndexedDB(pendingItem.id);
          return;
        }

        // Other errors - retry
        const errorMessage = err?.message || 'Unknown error';
        console.error(
          `Failed to process item ${pendingItem.id}:`,
          errorMessage
        );
        markFailed(
          pendingItem.id,
          errorMessage,
          pendingItem.clientId,
          pendingItem.type
        );
        await saveItemToIndexedDB({
          ...pendingItem,
          status: 'pending',
          attempts: pendingItem.attempts + 1,
          lastError: errorMessage,
        });
      }
    } finally {
      processingRef.current = false;
      // Always schedule next processing, even if no pending item
      timeoutRef.current = setTimeout(() => {
        processQueue();
      }, PROCESSING_DELAY);
    }
  }, [executeItem]);

  // Start queue processor loop on mount
  useEffect(() => {
    // Start the queue processor on mount
    if (!processingRef.current) {
      processQueue();
    }
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [processQueue]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
}
