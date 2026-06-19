/**
 * Supabase pgbouncer (transaction mode) does not honour session-level
 * statement_timeout, so hung queries block forever. Use these helpers
 * instead of raw Promise.all() for any server-component DB fetches.
 */

const DEFAULT_MS = 7000

/** Resolves with `fallback` if `promise` doesn't settle within `ms`. */
export function withTimeout<T>(promise: Promise<T>, fallback: T, ms = DEFAULT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms)),
  ])
}

/**
 * Drop-in replacement for Promise.all() for DB fetches.
 * Each entry is { promise, fallback }. If a query hangs or throws,
 * it returns the fallback value instead of blocking/crashing the page.
 *
 * Usage:
 *   const [users, products] = await safeAll([
 *     { promise: getUsers(), fallback: [] },
 *     { promise: getProducts(), fallback: [] },
 *   ])
 */
export function safeAll<T extends unknown[]>(
  entries: { [K in keyof T]: { promise: Promise<T[K]>; fallback: T[K] } },
  ms = DEFAULT_MS
): Promise<T> {
  return Promise.all(
    (entries as { promise: Promise<unknown>; fallback: unknown }[]).map(({ promise, fallback }) =>
      withTimeout(promise, fallback, ms).catch(() => fallback)
    )
  ) as Promise<T>
}
