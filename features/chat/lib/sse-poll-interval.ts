// Floor (and default) is deliberately ABOVE drizzle/db.ts's pooler idle_timeout (10s),
// not a UX tuning knob: postgres-js only returns an idle connection to the shared
// 15-connection pooler once it's actually been idle for idle_timeout. A poll interval
// shorter than that (the previous default/floor was 4000/2000ms) means the connection
// backing this stream never goes idle long enough to be released — it stays reserved
// for the connection's entire life instead of being briefly borrowed per tick. 15s
// gives ~5s of margin over the 10s idle_timeout so normal tick-duration jitter can't
// eat back into that gap. This floor applies even to a client that requests a shorter
// interval (clampPollIntervalMs below) — no client-side change is required for this
// fix to take effect. See docs/technical/chat-architecture-improvements.md.
export const SSE_POLL_DEFAULT_MS = 15_000;
export const SSE_POLL_MIN_MS = 15_000;
export const SSE_POLL_MAX_MS = 30_000;

export function clampPollIntervalMs(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return SSE_POLL_DEFAULT_MS;
  return Math.min(SSE_POLL_MAX_MS, Math.max(SSE_POLL_MIN_MS, Math.floor(n)));
}
