type Entry = { count: number; resetAt: number }

const store = new Map<string, Entry>()

/** Periodically purge expired entries to prevent memory growth. */
function purge() {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key)
  }
}

/**
 * Sliding fixed-window rate limiter (in-memory).
 * Returns { allowed: true } or { allowed: false, retryAfterMs: number }.
 *
 * @param key      Unique identifier — e.g. "phone-lookup:1.2.3.4"
 * @param limit    Max requests allowed in the window
 * @param windowMs Window length in milliseconds
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: true } | { allowed: false; retryAfterMs: number } {
  const now = Date.now()

  // Purge ~1% of the time to avoid unbounded memory growth
  if (Math.random() < 0.01) purge()

  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true }
  }

  if (entry.count >= limit) {
    return { allowed: false, retryAfterMs: entry.resetAt - now }
  }

  entry.count++
  return { allowed: true }
}
