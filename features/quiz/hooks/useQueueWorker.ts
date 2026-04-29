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
  const markOptionSaved = useQuizDraftStore(state => state.markOptionSaved);
  const markSaved = useQuizDraftStore(state => state.markSaved);

  const processingRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(false);

  const executeItem = useCallback(
    async (item: QueueItem): Promise<string[]> => {
      const processedItemIds: string[] = [];

      // Idempotency guard: skip CREATE if entity already created
      if (item.type === 'CREATE_QUESTION' || item.type === 'CREATE_OPTION') {
        const { isEntityCreated } = useAutosaveQueueStore.getState();
        if (isEntityCreated(item.clientId)) {
          console.log(
            `Entity ${item.clientId} already created, skipping ${item.type}`
          );
          return processedItemIds;
        }
      }

      switch (item.type) {
        case 'CREATE_OPTION': {
          // Batch all pending/processing CREATE_OPTION items for the same question.
          // Include 'processing' status because the trigger item was already marked as processing.
          const { queue } = useAutosaveQueueStore.getState();
          const createOptionItems = queue.filter(
            q =>
              q.type === 'CREATE_OPTION' &&
              q.questionId === item.questionId &&
              (q.status === 'pending' || q.status === 'processing')
          );

          const payloads = createOptionItems.map(
            q => q.payload as { optionText: string; isCorrect: boolean }
          );
          const res = await createOptions({
            questionId: item.questionId,
            data: payloads,
          });

          // createManyAndReturn returns an array of created option records.
          // Reconcile each temp option ID → real backend ID.
          if (res.data && Array.isArray(res.data)) {
            for (let i = 0; i < createOptionItems.length; i++) {
              const queueItem = createOptionItems[i];
              const backendId = res.data[i]?.id;
              if (backendId) {
                updateEntityId(queueItem.entityId, backendId);
                reconcileOptionId(
                  item.questionId,
                  queueItem.entityId,
                  backendId
                );
                markOptionSaved(item.questionId, backendId);
                markEntityCreated(queueItem.clientId);
              }
              processedItemIds.push(queueItem.id);
            }
          } else {
            // Fallback: if response shape is unexpected, still clean up queue
            for (const queueItem of createOptionItems) {
              markEntityCreated(queueItem.clientId);
              processedItemIds.push(queueItem.id);
            }
          }

          return processedItemIds;
        }

        case 'UPDATE_OPTION': {
          const payload = item.payload as {
            optionText: string;
            isCorrect: boolean;
          };
          await bulkUpdateOptions({
            data: [
              {
                id: item.entityId,
                optionText: payload.optionText,
                isCorrect: payload.isCorrect,
              },
            ],
          });
          // Clear isDirty after successful update
          markOptionSaved(item.questionId, item.entityId);
          processedItemIds.push(item.id);
          return processedItemIds;
        }

        case 'CREATE_QUESTION': {
          const payload = item.payload as {
            questionText: string;
            type: string;
            points: number;
            timeLimit: number;
          };
          const res = await createQuestion({
            quizId: item.quizId,
            data: payload,
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
            processedItemIds.push(item.id);
          }
          return processedItemIds;
        }

        case 'UPDATE_QUESTION': {
          const payload = item.payload as {
            id: string;
            questionText: string;
            points: number;
            timeLimit: number;
          };
          await bulkUpdateQuestions({
            data: [
              {
                id: item.entityId,
                questionText: payload.questionText,
                points: payload.points,
                timeLimit: payload.timeLimit,
              },
            ],
          });
          // Clear isDirty on question only, preserve option dirty flags
          markSaved([item.entityId], { clearOptions: false });
          processedItemIds.push(item.id);
          return processedItemIds;
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
      await saveItemToIndexedDB({
        ...pendingItem,
        status: 'processing',
      });

      try {
        // executeItem returns ALL item IDs it processed (including the trigger item for
        // batch operations like CREATE_OPTION). We use a fresh queue snapshot here so
        // we're never working off a stale closure reference.
        const processedItemIds = await executeItem(pendingItem);

        if (processedItemIds && processedItemIds.length > 0) {
          // Use a fresh snapshot so we resolve clientId/type for every batched item.
          const freshQueue = useAutosaveQueueStore.getState().queue;
          for (const id of processedItemIds) {
            const batchedItem = freshQueue.find(q => q.id === id);
            if (batchedItem) {
              markSuccess(
                batchedItem.id,
                batchedItem.clientId,
                batchedItem.type
              );
              await deleteItemFromIndexedDB(id);
            }
          }
        } else {
          // Fallback: if executeItem returned nothing (non-batch path), clean up the
          // trigger item directly.
          markSuccess(pendingItem.id, pendingItem.clientId, pendingItem.type);
          await deleteItemFromIndexedDB(pendingItem.id);
        }
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
      // Only schedule next processing if still mounted
      if (isMountedRef.current) {
        timeoutRef.current = setTimeout(() => {
          processQueue();
        }, PROCESSING_DELAY);
      }
    }
  }, [executeItem]);
  // Start queue processor loop on mount
  useEffect(() => {
    isMountedRef.current = true;
    // Start the queue processor on mount
    if (!processingRef.current) {
      processQueue();
    }
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [processQueue]);
}
