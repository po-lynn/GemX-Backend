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

const isDev = process.env.NODE_ENV !== "production"

function createConnection(): ReturnType<typeof postgres> {
  if (hasUrl) {
    return postgres(env.DATABASE_URL!, {
      max: 1,
      ssl: "require",
      connect_timeout: 10,
      idle_timeout: 20,
      max_lifetime: 60 * 30, // 30 minutes
      // Transaction pooler (port 6543) does not support prepared statements
      prepare: false,
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

const globalForDb = globalThis as unknown as { __postgres: ReturnType<typeof postgres> | undefined }

// Reuse one client per process (dev and serverless) to avoid connection churn
const connection = globalForDb.__postgres ?? (() => {
  const conn = createConnection()
  globalForDb.__postgres = conn
  return conn
})()

export const db = drizzle(connection, { schema })