import { create } from 'zustand';
import type { QueueItem } from '../hooks/autosaveQueue';
import {
  QUEUE_PRIORITY,
  saveItemToIndexedDB,
  deleteItemFromIndexedDB,
} from '../hooks/autosaveQueue';

const MAX_ATTEMPTS = 3;
const BASE_RETRY_DELAY = 1000;
const MAX_JITTER = 1000;

// Exponential backoff with jitter for retry scheduling
function getRetryDelay(attempts: number): number {
  const exponentialDelay = Math.pow(2, attempts) * BASE_RETRY_DELAY;
  const jitter = Math.random() * MAX_JITTER;
  return exponentialDelay + jitter;
}

type DeadLetterItem = {
  item: QueueItem;
  reason: string;
  failedAt: number;
};

type QueueState = {
  queue: QueueItem[];
  isProcessing: boolean;
  createdEntities: Record<string, boolean>; // clientId -> created mapping
  queueVersion: number; // Increment on every queue change (for worker trigger)
  deadLetterQueue: DeadLetterItem[]; // Items that exceeded max retries
  addToQueue: (item: QueueItem) => void;
  markProcessing: (id: string) => void;
  markSuccess: (id: string, clientId: string, type: QueueItem['type']) => void;
  markFailed: (
    id: string,
    error: string,
    clientId: string,
    type: QueueItem['type']
  ) => void;
  clearQueue: () => void;
  loadQueue: (items: QueueItem[]) => void;
  updateEntityId: (oldEntityId: string, newEntityId: string) => void;
  markEntityCreated: (clientId: string) => void;
  isEntityCreated: (clientId: string) => boolean;
  getNextPendingItem: () => QueueItem | undefined;
  clearDeadLetterQueue: () => void;
};

export const useAutosaveQueueStore = create<QueueState>((set, get) => ({
  queue: [],
  isProcessing: false,
  createdEntities: {},
  queueVersion: 0, // Increment on every change to trigger worker
  deadLetterQueue: [], // Items that exceeded max retries

  clearDeadLetterQueue: () => {
    set({ deadLetterQueue: [] });
  },

  loadQueue: items => {
    // Sort by priority (lower number = higher priority) then by createdAt
    const sortedItems = [...items].sort((a, b) => {
      const priorityDiff = QUEUE_PRIORITY[a.type] - QUEUE_PRIORITY[b.type];
      if (priorityDiff !== 0) return priorityDiff;
      return a.createdAt - b.createdAt;
    });
    // Persist all loaded items to IndexedDB (ensures DB is in sync with state)
    sortedItems.forEach(item => {
      saveItemToIndexedDB(item);
    });
    set({ queue: sortedItems });
  },

  // Check if an entity has already been created (idempotency guard)
  isEntityCreated: clientId => {
    const state = get();
    return !!state.createdEntities[clientId];
  },

  // Mark an entity as created (for CREATE operations)
  markEntityCreated: clientId => {
    set(state => ({
      createdEntities: {
        ...state.createdEntities,
        [clientId]: true,
      },
    }));
  },

  addToQueue: item => {
    set(state => {
      const now = Date.now();
      const itemWithMeta = {
        ...item,
        version: 1,
        updatedAt: now,
      };

      console.log(
        '[LWW-QUEUE][addToQueue] Incoming item:',
        JSON.stringify({
          id: item.id,
          type: item.type,
          clientId: item.clientId,
          entityId: item.entityId,
          createdAt: item.createdAt,
          payload: item.payload,
        })
      );
      console.log(
        '[LWW-QUEUE][addToQueue] Current queue length:',
        state.queue.length
      );

      // LAST-WRITE-WINS: Check for existing item with same clientId + type
      const existingIndex = state.queue.findIndex(
        q =>
          q.clientId === item.clientId &&
          q.type === item.type &&
          q.status !== 'completed'
      );

      if (existingIndex !== -1) {
        const existing = state.queue[existingIndex];
        console.log(
          '[LWW-QUEUE][addToQueue] Found existing item with same clientId+type:',
          JSON.stringify({
            id: existing.id,
            type: existing.type,
            clientId: existing.clientId,
            createdAt: existing.createdAt,
            status: existing.status,
          })
        );

        // SMART MERGE: If existing is CREATE and new is UPDATE for same temp ID,
        // merge into single CREATE with updated payload
        if (
          (existing.type === 'CREATE_QUESTION' &&
            item.type === 'UPDATE_QUESTION') ||
          (existing.type === 'CREATE_OPTION' && item.type === 'UPDATE_OPTION')
        ) {
          console.log(
            '[LWW-QUEUE][SMART-MERGE] Merging UPDATE into CREATE for clientId:',
            item.clientId
          );
          // Merge: update existing CREATE with new payload, bump version
          const mergedQueue = [...state.queue];
          mergedQueue[existingIndex] = {
            ...existing,
            payload: item.payload, // Use newer payload
            version: existing.version + 1,
            updatedAt: now,
          };
          console.log(
            '[LWW-QUEUE][SMART-MERGE] Merged item:',
            JSON.stringify({
              id: mergedQueue[existingIndex].id,
              version: mergedQueue[existingIndex].version,
              payload: mergedQueue[existingIndex].payload,
            })
          );
          // Persist merged item
          saveItemToIndexedDB(mergedQueue[existingIndex]);
          console.log('[LWW-QUEUE][SMART-MERGE] Persisted to IndexedDB');
          return {
            queue: mergedQueue,
            queueVersion: state.queueVersion + 1, // Trigger worker on queue change
          };
        }

        // LAST-WRITE-WINS: Replace with newer payload
        // Compare timestamps - only update if this is newer
        if (item.createdAt >= existing.createdAt) {
          console.log(
            '[LWW-QUEUE][REPLACE] New item is newer (or same time), replacing existing'
          );
          const mergedQueue = [...state.queue];
          mergedQueue[existingIndex] = {
            ...existing,
            payload: item.payload,
            version: existing.version + 1,
            updatedAt: now,
            createdAt: item.createdAt, // Use newer timestamp
          };
          console.log(
            '[LWW-QUEUE][REPLACE] Replaced item:',
            JSON.stringify({
              id: mergedQueue[existingIndex].id,
              version: mergedQueue[existingIndex].version,
              createdAt: mergedQueue[existingIndex].createdAt,
              payload: mergedQueue[existingIndex].payload,
            })
          );
          // Persist merged item
          saveItemToIndexedDB(mergedQueue[existingIndex]);
          console.log('[LWW-QUEUE][REPLACE] Persisted to IndexedDB');
          return {
            queue: mergedQueue,
            queueVersion: state.queueVersion + 1, // Trigger worker on queue change
          };
        }

        // Existing item is newer, skip this update
        console.log(
          '[LWW-QUEUE][SKIP] Existing item is newer, skipping this update',
          JSON.stringify({
            existingCreatedAt: existing.createdAt,
            incomingCreatedAt: item.createdAt,
          })
        );
        return state;
      }

      console.log('[LWW-QUEUE][NEW] No existing item found, adding as new');
      // Persist new item
      saveItemToIndexedDB(itemWithMeta);
      console.log(
        '[LWW-QUEUE][NEW] Persisted to IndexedDB, queueVersion:',
        state.queueVersion + 1
      );
      return {
        queue: [...state.queue, itemWithMeta],
        queueVersion: state.queueVersion + 1, // Trigger worker on queue change
      };
    });
  },

  markProcessing: id =>
    set(state => {
      const item = state.queue.find(q => q.id === id);
      if (item) {
        const updatedItem = { ...item, status: 'processing' } as QueueItem;
        saveItemToIndexedDB(updatedItem);
      }
      return {
        queue: state.queue.map(q =>
          q.id === id ? { ...q, status: 'processing' } : q
        ),
      };
    }),

  markSuccess: (id, clientId, type) =>
    set(state => {
      // For CREATE operations, mark the entity as created (idempotency guard)
      const newCreatedEntities = { ...state.createdEntities };
      if (type === 'CREATE_QUESTION' || type === 'CREATE_OPTION') {
        newCreatedEntities[clientId] = true;
      }

      // Remove from IndexedDB (item is being removed from queue)
      deleteItemFromIndexedDB(id);

      return {
        queue: state.queue.filter(q => q.id !== id),
        createdEntities: newCreatedEntities,
        queueVersion: state.queueVersion + 1, // Trigger worker on queue change
      };
    }),

  // Update queue references after reconciliation (temp ID → real ID)
  updateEntityId: (oldEntityId, newEntityId) => {
    set(state => ({
      queue: state.queue.map(q => {
        const shouldUpdateEntityId = q.entityId === oldEntityId;
        const shouldUpdateQuestionId = q.questionId === oldEntityId;

        if (!shouldUpdateEntityId && !shouldUpdateQuestionId) {
          return q;
        }

        return {
          ...q,
          entityId: shouldUpdateEntityId ? newEntityId : q.entityId,
          questionId: shouldUpdateQuestionId ? newEntityId : q.questionId,
        };
      }),
    }));
  },

  markFailed: (id, error, clientId, type) =>
    set(state => {
      const createdEntities = { ...state.createdEntities };

      // For CREATE operations that fail, don't mark as created (allow retry)
      if (type === 'CREATE_QUESTION' || type === 'CREATE_OPTION') {
        delete createdEntities[clientId];
      }

      const item = state.queue.find(q => q.id === id);
      if (item) {
        const newAttempts = item.attempts + 1;

        // Check if max attempts exceeded - move to dead letter queue
        if (newAttempts >= MAX_ATTEMPTS) {
          console.error(
            '[DEAD-LETTER] Item exceeded max attempts, moving to DLQ:',
            item.id,
            'type:',
            item.type,
            'clientId:',
            clientId
          );
          // Move to dead letter queue
          const deadLetterItem: DeadLetterItem = {
            item: { ...item, attempts: newAttempts, lastError: error },
            reason: `Max attempts (${MAX_ATTEMPTS}) exceeded: ${error}`,
            failedAt: Date.now(),
          };
          // Remove from main queue and add to DLQ
          saveItemToIndexedDB({
            ...item,
            status: 'failed',
            attempts: newAttempts,
            lastError: error,
          });
          return {
            queue: state.queue.filter(q => q.id !== id),
            deadLetterQueue: [...state.deadLetterQueue, deadLetterItem],
            createdEntities,
            queueVersion: state.queueVersion + 1,
          };
        }

        // Still under max attempts - keep in queue for retry
        const updatedItem = {
          ...item,
          status: 'pending',
          attempts: newAttempts,
          lastError: error,
          nextRetryAt: Date.now() + getRetryDelay(newAttempts), // Schedule next retry
        } as QueueItem;
        // Persist failed item for retry
        saveItemToIndexedDB(updatedItem);
      }

      return {
        queue: state.queue.map(q =>
          q.id === id
            ? {
                ...q,
                status: 'pending', // Reset to pending for retry
                attempts: q.attempts + 1,
                lastError: error,
                nextRetryAt: Date.now() + getRetryDelay(q.attempts + 1),
              }
            : q
        ),
        createdEntities,
        queueVersion: state.queueVersion + 1, // Trigger worker on queue change
      };
    }),

  clearQueue: () => set({ queue: [] }),

  // Get next pending item sorted by priority (CREATE_QUESTION > CREATE_OPTION > UPDATE_QUESTION > UPDATE_OPTION)
  // Only returns items that are ready for retry (nextRetryAt <= now or not set)
  getNextPendingItem: () => {
    const state = get();
    const now = Date.now();
    const pendingItems = state.queue.filter(q => {
      if (q.status !== 'pending') return false;
      // If nextRetryAt is set, only include if it's time for retry
      if (q.nextRetryAt && q.nextRetryAt > now) return false;
      return true;
    });

    if (pendingItems.length === 0) return undefined;

    // Sort by priority first, then by createdAt for FIFO within same priority
    return pendingItems.sort((a, b) => {
      const priorityDiff = QUEUE_PRIORITY[a.type] - QUEUE_PRIORITY[b.type];
      if (priorityDiff !== 0) return priorityDiff;
      return a.createdAt - b.createdAt;
    })[0];
  },
}));
