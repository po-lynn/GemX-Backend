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
    // PgBouncer transaction mode already pools — keep per-instance count low to
    // avoid exhausting Supabase's connection limit across concurrent Vercel invocations.
    max: isPooler ? 3 : 5,
    prepare: false,
    fetch_types: false,
    connect_timeout: 20,
    idle_timeout: 20,
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