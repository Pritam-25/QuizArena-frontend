'use client';

import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from './socketTypes';
import { env } from '@/lib/env';

/**
 * Typed socket handle used throughout the application.
 */
export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

/**
 * Returns the current socket instance.
 *
 * @throws if no socket has been initialised yet.
 */
export const getSocket = (): AppSocket => {
  if (!socket) {
    throw new Error(
      '[socket] Not initialised. Call connectSocket() before getSocket().'
    );
  }
  return socket;
};

/**
 * Creates or returns the existing singleton socket connection.
 *
 * Authentication is cookie-based: the HttpOnly `accessToken` cookie is sent
 * automatically by the browser when `withCredentials: true` is set. No explicit
 * token is needed here — the backend socketAuthMiddleware reads the cookie.
 *
 * If a socket already exists and is connected, it is returned as-is.
 * If it exists but is disconnected, it is cleaned up and recreated.
 *
 * @param url - Optional override for the socket server URL.
 *              Falls back to `NEXT_PUBLIC_SOCKET_URL` env variable.
 */
export const connectSocket = (url?: string): AppSocket => {
  if (socket?.connected) {
    return socket;
  }

  // Clean up a stale, disconnected socket before creating a new one.
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  const socketUrl = url ?? env.NEXT_PUBLIC_SOCKET_URL;

  socket = io(socketUrl, {
    withCredentials: true, // Sends HttpOnly accessToken cookie automatically
    transports: ['websocket'], // Skip long-polling for lower latency
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 10_000,
    timeout: 10_000,
    autoConnect: true,
  });

  return socket;
};

/**
 * Disconnects and destroys the current socket instance.
 *
 * Safe to call even if no socket exists.
 */
export const disconnectSocket = (): void => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
};
