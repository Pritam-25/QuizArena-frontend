'use client';
import { useSocket } from '@/providers/SocketProvider';

export function SocketDebug() {
  const { isConnected, isReconnecting, error, authenticatedUserId } =
    useSocket();

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 9999,
        background: '#1e293b',
        color: '#fff',
        padding: '12px 16px',
        borderRadius: 8,
        fontFamily: 'monospace',
        fontSize: 13,
        lineHeight: 1.6,
        border: '1px solid #334155',
      }}
    >
      <div>
        🔌 connected: <b>{String(isConnected)}</b>
      </div>
      <div>
        🔄 reconnecting: <b>{String(isReconnecting)}</b>
      </div>
      <div>
        🔑 userId: <b>{authenticatedUserId ?? 'null (guest)'}</b>
      </div>
      <div>
        ❌ error: <b>{error ?? 'none'}</b>
      </div>
    </div>
  );
}
