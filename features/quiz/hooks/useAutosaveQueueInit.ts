import { useEffect } from 'react';
import { useAutosaveQueueStore } from '../store/useAutosaveQueueStore';
import { loadQueueFromIndexedDB } from './autosaveQueue';

/**
 * useAutosaveQueueInit
 *
 * Initializes the autosave queue from IndexedDB on app startup.
 * Should be called once at the app root level.
 */
export function useAutosaveQueueInit() {
  const loadQueue = useAutosaveQueueStore(state => state.loadQueue);

  useEffect(() => {
    // Load persisted queue from IndexedDB
    loadQueueFromIndexedDB().then(items => {
      if (items.length > 0) {
        console.log(`Loaded ${items.length} pending items from queue`);
        loadQueue(items);
      }
    });
  }, [loadQueue]);
}
