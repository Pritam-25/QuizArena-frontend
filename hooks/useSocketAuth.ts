'use client';

import { useEffect, useState } from 'react';
import { connectSocket, disconnectSocket } from '@/lib/socket/socket';
import type { AppSocket } from '@/lib/socket/socket';
import type {
  SocketErrorPayload,
  SocketReadyPayload,
} from '@/lib/socket/socketTypes';

export interface SocketAuthState {
  /** The live socket instance (null when disabled or not yet created). */
  socket: AppSocket | null;
  /** True once the transport-level 'connect' event fires. */
  isConnected: boolean;
  /** True while the client is attempting to re-establish the connection. */
  isReconnecting: boolean;
  /**
   * Non-null when there is an active error (connect failure, server rejection,
   * or exhausted reconnect attempts).
   */
  error: string | null;
  /**
   * The authenticated user ID received from the server via 'socket:ready'.
   * Null until the event arrives or when the socket belongs to a guest.
   */
  authenticatedUserId: string | null;
}

const INITIAL_STATE: SocketAuthState = {
  socket: null,
  isConnected: false,
  isReconnecting: false,
  error: null,
  authenticatedUserId: null,
};

/**
 * Manages the Socket.IO connection lifecycle and maps socket events to
 * React state.
 *
 * @param enabled - Pass `false` to disconnect and reset all state
 *                  (e.g. on public/auth-only routes). Defaults to `true`.
 *
 * @example
 * // Connect whenever the component is mounted
 * const { socket, isConnected, authenticatedUserId } = useSocketAuth();
 *
 * @example
 * // Only connect for authenticated users
 * const { data: user } = useMe();
 * const { socket } = useSocketAuth(!!user);
 */
export const useSocketAuth = (enabled = true): SocketAuthState => {
  const [state, setState] = useState<SocketAuthState>(INITIAL_STATE);

  useEffect(() => {
    if (!enabled) {
      disconnectSocket();
      setState(INITIAL_STATE);
      return;
    }

    const s = connectSocket();
    setState(prev => ({ ...prev, socket: s }));

    // ── Connection lifecycle ───────────────────────────────────────────────

    const onConnect = () => {
      setState(prev => ({
        ...prev,
        isConnected: true,
        isReconnecting: false,
        error: null,
      }));
    };

    const onDisconnect = (reason: string) => {
      setState(prev => ({
        ...prev,
        isConnected: false,
        authenticatedUserId: null,
        // "io server disconnect" means the server deliberately closed the
        // socket (e.g. token expiry). Don't auto-reconnect — surface it.
        error:
          reason === 'io server disconnect'
            ? 'You were disconnected by the server.'
            : null,
      }));
    };

    const onReconnectAttempt = () => {
      setState(prev => ({ ...prev, isReconnecting: true, error: null }));
    };

    const onReconnect = () => {
      setState(prev => ({ ...prev, isReconnecting: false }));
    };

    const onReconnectFailed = () => {
      setState(prev => ({
        ...prev,
        isReconnecting: false,
        error: 'Unable to reconnect. Please refresh the page.',
      }));
    };

    const onConnectError = (err: Error) => {
      setState(prev => ({
        ...prev,
        isConnected: false,
        isReconnecting: false,
        error: err.message || 'Failed to connect to the server.',
      }));
    };

    // ── Application-level events ───────────────────────────────────────────

    const onSocketReady = ({ userId }: SocketReadyPayload) => {
      setState(prev => ({ ...prev, authenticatedUserId: userId }));
    };

    const onSocketError = ({ message }: SocketErrorPayload) => {
      setState(prev => ({ ...prev, error: message }));
    };

    // ── Register ──────────────────────────────────────────────────────────

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('connect_error', onConnectError);
    s.on('socket:ready', onSocketReady);
    s.on('socket:error', onSocketError);
    // Manager-level events (not on the socket itself in socket.io v4)
    s.io.on('reconnect_attempt', onReconnectAttempt);
    s.io.on('reconnect', onReconnect);
    s.io.on('reconnect_failed', onReconnectFailed);

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('connect_error', onConnectError);
      s.off('socket:ready', onSocketReady);
      s.off('socket:error', onSocketError);
      s.io.off('reconnect_attempt', onReconnectAttempt);
      s.io.off('reconnect', onReconnect);
      s.io.off('reconnect_failed', onReconnectFailed);
    };
  }, [enabled]);

  return state;
};
