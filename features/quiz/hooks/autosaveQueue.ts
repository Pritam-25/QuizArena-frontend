import { openDB, DBSchema, IDBPDatabase } from 'idb';

export type QueueItemType =
  | 'CREATE_OPTION'
  | 'UPDATE_OPTION'
  | 'CREATE_QUESTION'
  | 'UPDATE_QUESTION';

// Priority levels for queue processing (lower number = higher priority)
export const QUEUE_PRIORITY: Record<QueueItemType, number> = {
  CREATE_QUESTION: 1, // Highest priority - must exist before options
  CREATE_OPTION: 2,
  UPDATE_QUESTION: 3,
  UPDATE_OPTION: 4, // Lowest priority
};

/** Payload shapes for each queue item type */
export type QueueItemPayload =
  | {
      // CREATE_OPTION / UPDATE_OPTION
      optionText: string;
      isCorrect: boolean;
    }
  | {
      // CREATE_QUESTION
      questionText: string;
      type: string;
      points: number;
      timeLimit: number;
    }
  | {
      // UPDATE_QUESTION
      id: string;
      questionText: string;
      points: number;
      timeLimit: number;
    };

export type QueueItem = {
  id: string; // unique queue id
  type: QueueItemType;
  entityId: string; // temp or real entity ID (gets updated on reconciliation)
  clientId: string; // stable client-generated ID for deduplication (never changes)
  idempotencyKey?: string; // unique key for idempotent CREATE operations
  questionId: string;
  quizId: string;
  payload: QueueItemPayload;
  status: 'pending' | 'processing' | 'failed' | 'completed';
  attempts: number;
  createdAt: number;
  updatedAt: number; // timestamp of last update (for last-write-wins)
  version: number; // incrementing version for conflict detection
  lastError?: string;
  nextRetryAt?: number; // timestamp for next retry (for delayed retry scheduling)
};

interface AutosaveDBSchema extends DBSchema {
  autosaveQueue: {
    key: string;
    value: QueueItem;
    indexes: { 'by-status': string; 'by-entity': string };
  };
}

const DB_NAME = 'autosave-queue-db';
const STORE_NAME = 'autosaveQueue';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<AutosaveDBSchema> | null = null;

async function getDB(): Promise<IDBPDatabase<AutosaveDBSchema>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<AutosaveDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db: IDBPDatabase<AutosaveDBSchema>) {
      const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      store.createIndex('by-status', 'status');
      store.createIndex('by-entity', 'entityId');
    },
  });

  return dbInstance;
}

export async function loadQueueFromIndexedDB(): Promise<QueueItem[]> {
  try {
    console.log('[INDEXEDDB][LOAD] Starting to load queue from IndexedDB...');
    const db = await getDB();
    const items = await db.getAll(STORE_NAME);
    console.log(
      '[INDEXEDDB][LOAD] Raw items from IndexedDB:',
      items.length,
      items.map(i => ({
        id: i.id,
        type: i.type,
        status: i.status,
        clientId: i.clientId,
      }))
    );
    // Only load pending/processing items, discard failed/completed ones
    const pendingItems = items.filter(
      (item: QueueItem) =>
        item.status === 'pending' || item.status === 'processing'
    );
    console.log(
      '[INDEXEDDB][LOAD] Pending/processing items after filter:',
      pendingItems.length
    );
    // Sort by priority first, then by createdAt for FIFO within same priority
    const sorted = pendingItems.sort((a, b) => {
      const priorityDiff = QUEUE_PRIORITY[a.type] - QUEUE_PRIORITY[b.type];
      if (priorityDiff !== 0) return priorityDiff;
      return a.createdAt - b.createdAt;
    });
    console.log(
      '[INDEXEDDB][LOAD] Sorted items:',
      sorted.map(i => ({
        id: i.id,
        type: i.type,
        priority: QUEUE_PRIORITY[i.type],
      }))
    );
    return sorted;
  } catch (error) {
    console.error(
      '[INDEXEDDB][LOAD] Failed to load queue from IndexedDB:',
      error
    );
    return [];
  }
}

export async function saveItemToIndexedDB(item: QueueItem): Promise<void> {
  try {
    console.log(
      '[INDEXEDDB][SAVE] Saving item:',
      JSON.stringify({
        id: item.id,
        type: item.type,
        clientId: item.clientId,
        entityId: item.entityId,
        status: item.status,
        version: item.version,
        attempts: item.attempts,
        payload: item.payload,
      })
    );
    const db = await getDB();
    if (item.status === 'completed') {
      console.log(
        '[INDEXEDDB][SAVE] Item status is completed, deleting from IndexedDB:',
        item.id
      );
      await db.delete(STORE_NAME, item.id);
    } else {
      console.log('[INDEXEDDB][SAVE] Putting item to IndexedDB:', item.id);
      await db.put(STORE_NAME, item);
    }
    console.log('[INDEXEDDB][SAVE] Successfully saved item:', item.id);
  } catch (error) {
    console.error('[INDEXEDDB][SAVE] Failed to save item to IndexedDB:', error);
  }
}

export async function deleteItemFromIndexedDB(id: string): Promise<void> {
  try {
    console.log('[INDEXEDDB][DELETE] Deleting item from IndexedDB:', id);
    const db = await getDB();
    await db.delete(STORE_NAME, id);
    console.log('[INDEXEDDB][DELETE] Successfully deleted item:', id);
  } catch (error) {
    console.error(
      '[INDEXEDDB][DELETE] Failed to delete item from IndexedDB:',
      error
    );
  }
}
