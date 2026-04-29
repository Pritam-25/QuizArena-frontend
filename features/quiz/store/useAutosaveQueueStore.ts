import { create } from 'zustand';
import type { QueueItem } from '../hooks/autosaveQueue';

type QueueState = {
  queue: QueueItem[];
  isProcessing: boolean;
  createdEntities: Record<string, boolean>; // clientId -> created mapping
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
};

export const useAutosaveQueueStore = create<QueueState>((set, get) => ({
  queue: [],
  isProcessing: false,
  createdEntities: {},

  loadQueue: items => set({ queue: items }),

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
      // CRITICAL: Deduplication by clientId (stable ID) not entityId (changes on reconciliation)
      const existing = state.queue.find(
        q =>
          q.clientId === item.clientId &&
          q.type === item.type &&
          (q.status === 'pending' || q.status === 'processing')
      );

      if (existing) {
        // Update existing item with new payload instead of adding duplicate
        return {
          queue: state.queue.map(q =>
            q.id === existing.id
              ? { ...q, payload: item.payload, createdAt: Date.now() }
              : q
          ),
        };
      }

      return {
        queue: [...state.queue, item],
      };
    });
  },

  markProcessing: id =>
    set(state => ({
      queue: state.queue.map(q =>
        q.id === id ? { ...q, status: 'processing' } : q
      ),
    })),

  markSuccess: (id, clientId, type) =>
    set(state => {
      // For CREATE operations, mark the entity as created (idempotency guard)
      const newCreatedEntities = { ...state.createdEntities };
      if (type === 'CREATE_QUESTION' || type === 'CREATE_OPTION') {
        newCreatedEntities[clientId] = true;
      }

      return {
        queue: state.queue.filter(q => q.id !== id),
        createdEntities: newCreatedEntities,
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

      return {
        queue: state.queue.map(q =>
          q.id === id
            ? {
                ...q,
                status: 'pending', // Reset to pending for retry
                attempts: q.attempts + 1,
                lastError: error,
              }
            : q
        ),
        createdEntities,
      };
    }),

  clearQueue: () => set({ queue: [] }),
}));
