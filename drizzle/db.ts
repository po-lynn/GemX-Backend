import { env } from "@/data/env/server"
import postgres from "postgres"
import { drizzle } from "drizzle-orm/postgres-js"
import * as schema from "./schema"

const hasUrl = !!env.DATABASE_URL
const hasParts = [env.DB_HOST, env.DB_USER, env.DB_NAME, env.DB_PASSWORD].every(Boolean)
if (!hasUrl && !hasParts) {
  throw new Error(
    "Database config missing. Set DATABASE_URL (Vercel/Supabase) or DB_HOST, DB_USER, DB_NAME, DB_PASSWORD (local)."
  )
}

const globalForDb = globalThis as unknown as {
  __postgres: ReturnType<typeof postgres> | undefined
}

function createConnection(): ReturnType<typeof postgres> {
  if (hasUrl) {
    const url = env.DATABASE_URL!
    // Use Transaction mode (port 6543) in production to avoid "max clients reached" with serverless.
    // Session mode (5432) has a small pool; many serverless instances exhaust it.
    const isTransactionPooler = url.includes(":6543/")
    return postgres(url, {
      max: 1,
      ssl: "require",
      connect_timeout: 10,
      idle_timeout: isTransactionPooler ? 60 : 120,
      max_lifetime: isTransactionPooler ? 300 : 60 * 10,
      prepare: !isTransactionPooler,
      fetch_types: false,
      connection: { statement_timeout: 15_000 },
      onclose: () => {
        globalForDb.__postgres = undefined
      },
    })
  }
  return postgres({
    host: env.DB_HOST!,
    database: env.DB_NAME!,
    username: env.DB_USER!,
    password: env.DB_PASSWORD!,
    max: 1,
  })
}

function getConnection(): ReturnType<typeof postgres> {
  if (globalForDb.__postgres) return globalForDb.__postgres
  const conn = createConnection()
  globalForDb.__postgres = conn
  return conn
}

// Lazy client: each access uses current connection and recovers after close (e.g. pooler closed socket)
const sqlProxy = new Proxy({} as ReturnType<typeof postgres>, {
  get(_, prop) {
    return (getConnection() as unknown as Record<string | symbol, unknown>)[prop]
  },
})

export const db = drizzle(sqlProxy, { schema })