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

/** Vercel + Supabase: set DATABASE_URL. Local: set DB_HOST, DB_USER, DB_NAME, DB_PASSWORD. */
const connection = hasUrl
  ? postgres(env.DATABASE_URL!, { max: 1 })
  : postgres({
      host: env.DB_HOST!,
      database: env.DB_NAME!,
      username: env.DB_USER!,
      password: env.DB_PASSWORD!,
      max: 1,
    })

export const db = drizzle(connection, { schema })