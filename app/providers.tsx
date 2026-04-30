'use client';

import {
  environmentManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { SocketProvider, useSocket } from '@/providers/SocketProvider';
import { SocketConnectionStatus } from '@/components/socket/SocketConnectionStatus';

// TEMP: Debug widget for socket state
import { SocketDebug } from '@/components/socket/SocketDebug';

/**
 * Creates a new QueryClient instance with default configuration.
 *
 * @returns {QueryClient} A configured QueryClient instance
 *
 * @description
 * - `staleTime`: Prevents immediate refetch after mount (improves UX)
 * - `retry`:
 *    - Queries retry once (network safety)
 *    - Mutations do NOT retry (important for login/signup)
 */
function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute
        retry: 1,
        refetchOnWindowFocus: false, // optional (reduce noise)
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

/**
 * Singleton QueryClient for browser environment.
 *
 * @description
 * Prevents re-creating QueryClient on every render in the browser,
 * which would otherwise reset cache and break React Query behavior.
 */
let browserQueryClient: QueryClient | undefined;

/**
 * Returns the appropriate QueryClient depending on environment.
 *
 * @returns {QueryClient}
 *
 * @description
 * - Server: always create a new client (per request isolation)
 * - Browser: reuse a single instance (cache persistence)
 */
function getQueryClient(): QueryClient {
  if (environmentManager.isServer()) {
    return makeQueryClient();
  }

  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }

  return browserQueryClient;
}

/**
 * Global Providers component for the application.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Application components
 *
 * @returns {JSX.Element}
 *
 * @description
 * - Wraps the app with React Query provider
 * - Attaches React Query Devtools (only in development)
 *
 * @example
 * // usage in layout.tsx
 * <Providers>
 *   {children}
 * </Providers>
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <SocketProvider>
        {children}
        {/* TEMP: Debug widget for socket state (remove after testing) */}
        <SocketDebug />
        {/* Rendered inside SocketProvider so it can call useSocket() */}
        <SocketStatusBridge />
      </SocketProvider>

      {/* React Query Devtools (auto disabled in production) */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

/**
 * Reads socket state and renders the connection status badge.
 *
 * Lives inside SocketProvider so it can safely call useSocket().
 * Kept separate from Providers so Providers itself stays clean.
 */
function SocketStatusBridge() {
  const { isConnected, isReconnecting, error } = useSocket();

  return (
    <SocketConnectionStatus
      isConnected={isConnected}
      isReconnecting={isReconnecting}
      error={error}
    />
  );
}
