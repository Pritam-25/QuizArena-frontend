'use client';

import { cn } from '@/lib/utils';

interface SocketConnectionStatusProps {
  isConnected: boolean;
  isReconnecting: boolean;
  error: string | null;
  /** Override default fixed positioning for inline use. */
  className?: string;
}

/**
 * Small status badge that surfaces socket connection state to the user.
 *
 * Renders nothing when the socket is healthy and connected — no UI noise
 * during normal operation. Only becomes visible on degraded states.
 */
export function SocketConnectionStatus({
  isConnected,
  isReconnecting,
  error,
  className,
}: SocketConnectionStatusProps) {
  if (isConnected && !error) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed right-4 top-4 z-50 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium shadow-lg backdrop-blur-sm',
        error && 'border border-red-800/60 bg-red-950/90 text-red-300',
        isReconnecting &&
          !error &&
          'border border-yellow-700/60 bg-yellow-950/90 text-yellow-300',
        !isConnected &&
          !isReconnecting &&
          !error &&
          'border border-zinc-700/60 bg-zinc-900/90 text-zinc-400',
        className
      )}
    >
      {error ? (
        <>
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
          {error}
        </>
      ) : isReconnecting ? (
        <>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-400" />
          Reconnecting…
        </>
      ) : (
        <>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-500" />
          Connecting…
        </>
      )}
    </div>
  );
}
