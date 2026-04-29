import { openDB, DBSchema, IDBPDatabase } from 'idb';

export type QueueItemType =
  | 'CREATE_OPTION'
  | 'UPDATE_OPTION'
  | 'CREATE_QUESTION'
  | 'UPDATE_QUESTION';

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
  questionId: string;
  quizId: string;
  payload: QueueItemPayload;
  status: 'pending' | 'processing' | 'failed' | 'completed';
  attempts: number;
  createdAt: number;
  lastError?: string;
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
    const db = await getDB();
    const items = await db.getAll(STORE_NAME);
    // Only load pending/processing items, discard failed ones
    return items
      .filter((item: QueueItem) => item.status !== 'completed')
      .sort((a, b) => a.createdAt - b.createdAt);
  } catch (error) {
    console.error('Failed to load queue from IndexedDB:', error);
    return [];
  }
}

export async function saveItemToIndexedDB(item: QueueItem): Promise<void> {
  try {
    const db = await getDB();
    if (item.status === 'completed') {
      await db.delete(STORE_NAME, item.id);
    } else {
      await db.put(STORE_NAME, item);
    }
  } catch (error) {
    console.error('Failed to save item to IndexedDB:', error);
  }
}

export async function deleteItemFromIndexedDB(id: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete(STORE_NAME, id);
  } catch (error) {
    console.error('Failed to delete item from IndexedDB:', error);
  }
}
