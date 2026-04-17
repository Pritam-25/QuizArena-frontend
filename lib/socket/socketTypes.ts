/**
 * Frontend Socket.IO event types.
 */

// ─── Shared Payloads ─────────────────────────────────────────────────────────

/** Received once per connection. `userId` is null for unauthenticated guests. */
export interface SocketReadyPayload {
  userId: string | null;
}

/** Standard error payload emitted by the server. */
export interface SocketErrorPayload {
  statusCode: number;
  errorCode: string;
  message: string;
  details?: unknown;
}

// ─── Events: Server → Client ─────────────────────────────────────────────────

export interface ServerToClientEvents {
  // ── Connection lifecycle ─────────────────────────────────────────────────
  'socket:ready': (payload: SocketReadyPayload) => void;
  'socket:error': (payload: SocketErrorPayload) => void;

  // ── Session events ───────────────────────────────────────────────────────
  'player:joined': (payload: Record<string, unknown>) => void;
  'session:host-joined': (payload: Record<string, unknown>) => void;
  'session:started': (payload: { sessionId: string }) => void;

  // ── Question events ──────────────────────────────────────────────────────
  'question:started': (payload: Record<string, unknown>) => void;
  'question:ended': (payload: Record<string, unknown>) => void;

  // ── Leaderboard / scoring ────────────────────────────────────────────────
  'leaderboard:update': (payload: Record<string, unknown>) => void;

  // ── Per-event errors (e.g. 'session:join:error') ─────────────────────────
  'session:join:error': (payload: SocketErrorPayload) => void;
  'session:host-join:error': (payload: SocketErrorPayload) => void;
  'session:start:error': (payload: SocketErrorPayload) => void;
  'question:next:error': (payload: SocketErrorPayload) => void;
  'answer:update:error': (payload: SocketErrorPayload) => void;
}

// ─── Events: Client → Server ─────────────────────────────────────────────────

export interface ClientToServerEvents {
  'session:join': (payload: { joinCode: string; nickname: string }) => void;
  'session:host-join': (payload: { sessionId: string }) => void;
  'session:start': (payload: { sessionId: string }) => void;
  'question:next': (payload: { sessionId: string }) => void;
  'answer:update': (payload: {
    questionId: string;
    optionId?: string;
    answerText?: string;
  }) => void;
}
