import { defineConfig } from 'orval';

/**
 * Orval Configuration (v8.8.0 compatible)
 *
 * @description
 * Production-ready setup using React Query + custom API client.
 *
 * Notes:
 * - Uses `query` (NOT queryOptions) → required for v8
 * - Enables infinite queries
 * - Enables cache helpers (set/get query data)
 * - Centralizes API handling via custom mutator
 */
export default defineConfig({
  backendApi: {
    /**
     * OpenAPI specification source
     *
     * @description
     * Points to backend-generated OpenAPI JSON.
     * You can also copy it locally if needed.
     */
    input: {
      target: '../backend/openapi/openapi.json',
    },

    output: {
      /**
       * Output mode
       *
       * @description
       * Splits API by tags (auth, user, quiz, etc.)
       * Helps maintain scalability in large projects.
       */
      mode: 'tags-split',

      /**
       * Entry file for generated API
       */
      target: './api/index.ts',

      /**
       * Folder for generated TypeScript schemas
       */
      schemas: './api/model',

      /**
       * Generate React Query hooks
       */
      client: 'react-query',

      /**
       * Clean old generated files before regeneration
       */
      clean: true,

      /**
       * Enable mock generation (useful for testing/dev)
       * turn on if you want to generate MSW mocks
       */
      // mock: true,

      override: {
        /**
         * Custom API client
         */
        mutator: {
          path: './lib/api/client.ts',
          name: 'apiClient',
        },

        /**
         * Return only API response (no HTTP wrapper)
         */
        fetch: {
          includeHttpResponseReturnType: false,
        },

        /**
         * Query configuration (v8 style)
         */
        query: {
          useQuery: true,
          useInfinite: true,
          useInfiniteQueryParam: 'nextId',

          options: {
            staleTime: 60 * 1000,
          },
          /**
           * Cache helpers (IMPORTANT)
           */
          useSetQueryData: true,
          useGetQueryData: true,
        },
      },
    },
  },
});
