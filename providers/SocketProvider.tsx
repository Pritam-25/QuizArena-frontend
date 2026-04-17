"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useSocketAuth, type SocketAuthState } from "@/hooks/useSocketAuth";

type SocketContextValue = SocketAuthState;

const SocketContext = createContext<SocketContextValue | null>(null);

interface SocketProviderProps {
  /**
   * When false the socket is disconnected and all state is reset.
   * Useful for mounting the provider high in the tree but only activating it
   * on protected routes (e.g. pass `enabled={!!authenticatedUser}`).
   * Defaults to `true`.
   */
  enabled?: boolean;
  children: ReactNode;
}

/**
 * Provides socket state to the component tree via React context.
 *
 * Mount once above the part of the tree that needs real-time features.
 * For unauthenticated routes (login, signup) pass `enabled={false}` so no
 * WebSocket is opened unnecessarily.
 *
 * @example
 * // Always connected (backend allows guest sockets)
 * <SocketProvider>{children}</SocketProvider>
 *
 * @example
 * // Only connect when the user is logged in
 * <SocketProvider enabled={!!user}>{children}</SocketProvider>
 */
export function SocketProvider({ enabled = true, children }: SocketProviderProps) {
  const socketState = useSocketAuth(enabled);

  return (
    <SocketContext.Provider value={socketState}>
      {children}
    </SocketContext.Provider>
  );
}

/**
 * Returns the current socket state from the nearest `<SocketProvider>`.
 *
 * @throws when called outside of a `<SocketProvider>`.
 *
 * @example
 * const { socket, isConnected, authenticatedUserId, error } = useSocket();
 */
export function useSocket(): SocketContextValue {
  const ctx = useContext(SocketContext);

  if (!ctx) {
    throw new Error(
      "[useSocket] Must be called inside a <SocketProvider>. " +
        "Wrap your component tree with <SocketProvider>."
    );
  }

  return ctx;
}
