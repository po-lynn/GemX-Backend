/**
 * Bounds how long a route handler waits on a DB call before giving up.
 *
 * Supabase's pooler (PgBouncer transaction mode) silently ignores session-level
 * `statement_timeout` (see drizzle/db.ts), so a stalled/queued query has no ceiling on the
 * Postgres side. This wrapper gives the *client* a fast, clean failure instead of an
 * indefinite hang — but it does not cancel the underlying query on the database, so a timed-out
 * call can still hold its connection until Postgres/the pooler eventually finishes or drops it.
 * Treat this as a client-experience fix, not a substitute for keeping query volume and pool
 * size low (see cache/products.ts, cache/news.ts and the sequential-await pattern in
 * app/api/news/route.ts).
 */
export class QueryTimeoutError extends Error {
  readonly isTimeout = true as const

  constructor(label: string, ms: number) {
    super(`Query "${label}" timed out after ${ms}ms`)
    this.name = "QueryTimeoutError"
  }
}

export function withQueryTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new QueryTimeoutError(label, ms)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}
