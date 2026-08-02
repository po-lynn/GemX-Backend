import { env } from "@/data/env/server"
import postgres from "postgres"
import { drizzle } from "drizzle-orm/postgres-js"
import * as schema from "./schema"

if (!env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing")
}

const isPooler = env.DATABASE_URL.includes(":6543")

const globalForDb = globalThis as unknown as {
  dbClient?: postgres.Sql
}

const client =
  globalForDb.dbClient ??
  postgres(env.DATABASE_URL, {
    ssl: "require",
    // Supabase's pooler multiplexes client connections down to a small, fixed number of
    // real backend connections (Settings → Database → Connection pooling — "Pool Size",
    // 15 on the Micro compute tier, shared across every concurrent Vercel invocation
    // project-wide). Each mobile screen load fires several parallel requests, so a handful
    // of concurrent Vercel instances can already request more connections than the pooler
    // has backend slots for. Keep max low so no single instance can monopolize a large
    // share of that shared ceiling — this bounds concurrency, it does not raise it.
    max: isPooler ? 4 : 15,
    prepare: false,
    fetch_types: false,
    connect_timeout: 20,
    // Release idle connections back quickly on the pooler path so a burst on one instance
    // doesn't keep slots reserved once its requests finish.
    idle_timeout: isPooler ? 10 : 20,
    max_lifetime: 300,
    // session-level settings only persist on direct connections (port 5432).
    // PgBouncer transaction mode (port 6543) resets session state per transaction,
    // so statement_timeout set here would be silently ignored in production.
    // Use onnotice/transforms or SET per-query if you need timeouts on the pooler.
    ...(isPooler
      ? {}
      : {
          connection: {
            statement_timeout: 15_000,
            idle_in_transaction_session_timeout: 10_000,
          },
        }),
  })

// Cache on globalThis so warm Vercel instances and Next.js HMR both reuse the pool.
globalForDb.dbClient = client

export const db = drizzle(client, { schema })