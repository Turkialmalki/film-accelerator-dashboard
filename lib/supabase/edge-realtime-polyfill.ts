/**
 * @supabase/supabase-js's SupabaseClient constructs a RealtimeClient
 * synchronously inside its own constructor — even for callers, like this
 * app's middleware and API routes, that only ever call `.auth.getUser()` or
 * a table query and never touch realtime. That RealtimeClient constructor
 * throws immediately if `globalThis.WebSocket` is undefined.
 *
 * Two runtimes this app actually deploys to lack a global WebSocket:
 * Node.js before v21 (native support landed in 21, stable in 22 — Vercel's
 * Node.js Serverless Functions and this project's own dev machine both run
 * Node 20), and Vercel's Edge Runtime, which this app's middleware.ts runs
 * on and which has no outbound `new WebSocket()` for ordinary requests.
 *
 * Confirmed in production: middleware.ts crashed with
 * MIDDLEWARE_INVOCATION_FAILED as soon as real Supabase credentials made it
 * actually construct a client, even though it only ever calls
 * `supabase.auth.getUser()`. A local `next start` did not reproduce this —
 * Next's local Edge Runtime emulation is more lenient than Vercel's real
 * Edge sandbox — so this must be verified live, not by a local repro alone.
 *
 * The stub below exists purely so client construction does not crash the
 * request. Nothing in this app is expected to actually open a socket from a
 * server context — realtime subscriptions, if this app ever adds them, only
 * make sense from the browser, where a real WebSocket already exists.
 */
if (typeof globalThis.WebSocket === 'undefined') {
  class NoopWebSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;
    constructor() {
      throw new Error(
        'WebSocket is not available in this runtime, and nothing in this app opens one intentionally from the server.',
      );
    }
  }
  // @ts-expect-error — deliberately minimal; see file comment above.
  globalThis.WebSocket = NoopWebSocket;
}

export {};
