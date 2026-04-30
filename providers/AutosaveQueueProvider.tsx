'use client';

import { useEffect, useRef } from 'react';
import { loadQueueFromIndexedDB } from '@/features/quiz/hooks/autosaveQueue';
import { useAutosaveQueueStore } from '@/features/quiz/store/useAutosaveQueueStore';

/**
 * AutosaveQueueProvider
 *
 * Loads the persisted autosave queue from IndexedDB on app start.
 * This ensures queue survives page reloads and enables offline-first sync.
 */
export function AutosaveQueueProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loadQueue } = useAutosaveQueueStore();
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    // Prevent duplicate loads
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    // Load persisted queue from IndexedDB
    loadQueueFromIndexedDB().then(items => {
      if (items.length > 0) {
        console.log(
          `[AutosaveQueueProvider] Loaded ${items.length} pending items from IndexedDB:`,
          items.map(i => ({ id: i.id, type: i.type, status: i.status }))
        );
        loadQueue(items);
      } else {
        console.log('[AutosaveQueueProvider] No pending items in IndexedDB');
      }
    });
  }, [loadQueue]);

  return <>{children}</>;
}
