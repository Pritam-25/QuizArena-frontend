import { useCallback, useEffect, useRef, useState } from 'react';
import { useAutosaveQueueStore } from '../store/useAutosaveQueueStore';
import {
  usePostQuizzesQuestionsQuestionIdOptions,
  usePatchQuizzesOptionsBulk,
  usePostQuizzesQuizIdQuestions,
  usePatchQuizzesQuestionsBulk,
} from '@/api/quiz/quiz';
import type { QueueItem } from './autosaveQueue';
import { QUEUE_PRIORITY } from './autosaveQueue';
import { useQuizDraftStore } from '../store/useQuizDraftStore';

const MAX_ATTEMPTS = 3;
const BASE_RETRY_DELAY = 1000; // 1 second base for exponential backoff
const PROCESSING_DELAY = 100; // ms between processing items (faster drain when queue has items)
const MAX_JITTER = 1000; // max 1 second jitter

// Exponential backoff with jitter: 2^attempt * baseDelay + random jitter
// Jitter prevents retry storms when multiple clients retry simultaneously
function getRetryDelay(attempts: number): number {
  const exponentialDelay = Math.pow(2, attempts) * BASE_RETRY_DELAY;
  const jitter = Math.random() * MAX_JITTER;
  return exponentialDelay + jitter;
}

/**
 * useQueueWorker
 *
 * Background worker that processes the autosave queue.
 * Runs continuously, processing pending items one at a time.
 * Handles retries with exponential backoff.
 * Pauses when offline, resumes when connection restored.
 *
 * Reactively processes queue whenever it changes (queueVersion increments).
 */
export function useQueueWorker() {
  const { updateEntityId, markEntityCreated, queueVersion } =
    useAutosaveQueueStore();
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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
          // [queue][create-option] Numbering starts from 1 for create
          console.log(
            `1. [queue][create-option] Sending create option(s) for questionId: ${item.questionId}`,
            item
          );
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
                console.log(
                  `2. [queue][create-option][response] Option created. TempId: ${queueItem.entityId}, BackendId: ${backendId}`
                );
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
          // [queue][update-option] Numbering starts from 1 for update
          console.log(
            `1. [queue][update-option] Sending update for optionId: ${item.entityId} in questionId: ${item.questionId}`,
            item
          );
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
          // [queue][create-question] Numbering starts from 1 for create
          console.log(
            `1. [queue][create-question] Sending create question for quizId: ${item.quizId}`,
            item
          );
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
            console.log(
              `2. [queue][create-question][response] Question created. TempId: ${item.entityId}, BackendId: ${backendId}`
            );
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
          // [queue][update-question] Numbering starts from 1 for update
          console.log(
            `1. [queue][update-question] Sending update for questionId: ${item.entityId}`,
            item
          );
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
    if (processingRef.current) {
      console.log('[WORKER][processQueue] Already processing, skipping...');
      return;
    }
    processingRef.current = true;

    try {
      const {
        getNextPendingItem,
        markProcessing,
        markSuccess,
        markFailed,
        queue,
      } = useAutosaveQueueStore.getState();

      console.log(
        '[WORKER][processQueue] Starting, queueVersion:',
        queueVersion,
        'Queue length:',
        queue.length,
        'Pending items:',
        queue.filter(q => q.status === 'pending').length
      );

      // Get highest priority pending item that is ready for retry
      const now = Date.now();
      const pendingItem = getNextPendingItem();

      // Check if item is ready for retry (respects nextRetryAt for exponential backoff)
      if (
        pendingItem &&
        pendingItem.nextRetryAt &&
        pendingItem.nextRetryAt > now
      ) {
        console.log(
          '[WORKER][processQueue] Item not ready for retry yet:',
          pendingItem.id,
          'nextRetryAt:',
          new Date(pendingItem.nextRetryAt).toISOString(),
          'current:',
          new Date(now).toISOString()
        );
        // Don't process this item yet - wait for next trigger
        return;
      }

      if (!pendingItem) {
        console.log('[WORKER][processQueue] No pending items found, stopping');
        // No pending item, but keep polling
        return;
      }

      console.log(
        '[WORKER][processQueue] Selected item for processing:',
        JSON.stringify({
          id: pendingItem.id,
          type: pendingItem.type,
          clientId: pendingItem.clientId,
          entityId: pendingItem.entityId,
          status: pendingItem.status,
          attempts: pendingItem.attempts,
          version: pendingItem.version,
          priority: QUEUE_PRIORITY[pendingItem.type],
        })
      );

      // Check if max attempts exceeded
      if (pendingItem.attempts >= MAX_ATTEMPTS) {
        console.error(
          '[WORKER][processQueue] Max attempts exceeded for item',
          pendingItem.id,
          'attempts:',
          pendingItem.attempts,
          ', dropping'
        );
        markSuccess(pendingItem.id, pendingItem.clientId, pendingItem.type);
        return;
      }

      console.log(
        '[WORKER][processQueue] Marking item as processing:',
        pendingItem.id
      );
      markProcessing(pendingItem.id);

      try {
        console.log('[WORKER][processQueue] Executing item:', pendingItem.id);
        // executeItem returns ALL item IDs it processed (including the trigger item for
        // batch operations like CREATE_OPTION). We use a fresh queue snapshot here so
        // we're never working off a stale closure reference.
        const processedItemIds = await executeItem(pendingItem);

        console.log(
          '[WORKER][processQueue] Execute completed, processedItemIds:',
          processedItemIds
        );

        if (processedItemIds && processedItemIds.length > 0) {
          // Use a fresh snapshot so we resolve clientId/type for every batched item.
          const freshQueue = useAutosaveQueueStore.getState().queue;
          for (const id of processedItemIds) {
            const batchedItem = freshQueue.find(q => q.id === id);
            if (batchedItem) {
              console.log(
                '[WORKER][processQueue] Marking success for item:',
                batchedItem.id,
                'type:',
                batchedItem.type,
                'clientId:',
                batchedItem.clientId
              );
              markSuccess(
                batchedItem.id,
                batchedItem.clientId,
                batchedItem.type
              );
            }
          }
        } else {
          // Fallback: if executeItem returned nothing (non-batch path), clean up the
          // trigger item directly.
          console.log(
            '[WORKER][processQueue] No processedItemIds returned, marking trigger item as success:',
            pendingItem.id
          );
          markSuccess(pendingItem.id, pendingItem.clientId, pendingItem.type);
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
          return;
        }

        // Other errors - retry with exponential backoff
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
        // Schedule retry with exponential backoff delay
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        const retryDelay = getRetryDelay(pendingItem.attempts + 1);
        timeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            processQueue();
          }
        }, retryDelay);
        return;
      }
    } finally {
      processingRef.current = false;
      // Only schedule next processing if still mounted
      if (isMountedRef.current) {
        // Check if there are more items to process
        const { queue } = useAutosaveQueueStore.getState();
        const hasPendingItems = queue.some(q => q.status === 'pending');

        if (hasPendingItems) {
          // Continue processing immediately (fast drain)
          timeoutRef.current = setTimeout(() => {
            processQueue();
          }, PROCESSING_DELAY);
        }
        // No pending items - stop polling, wait for queueVersion change trigger
      }
    }
  }, [executeItem]);

  // Start queue processor loop on mount (initial trigger)
  useEffect(() => {
    isMountedRef.current = true;
    // Start the queue processor on mount
    if (!processingRef.current && isOnline) {
      processQueue();
    }
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reactively trigger processing when queue changes (event-driven)
  // This is the KEY FIX: worker responds to queue changes instead of polling
  useEffect(() => {
    if (isOnline && !processingRef.current) {
      // Queue changed - check if there's work to do
      const { queue } = useAutosaveQueueStore.getState();
      const hasPendingItems = queue.some(q => q.status === 'pending');
      if (hasPendingItems) {
        processQueue();
      }
    }
  }, [queueVersion, isOnline]); // eslint-disable-line react-hooks/exhaustive-deps
}
