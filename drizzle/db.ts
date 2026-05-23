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
    max: isPooler ? 1 : 5,
    prepare: false,
    fetch_types: false,
    connect_timeout: 10,
    idle_timeout: 20,
    max_lifetime: 300,
    connection: {
      statement_timeout: 15_000,
      idle_in_transaction_session_timeout: 10_000,
    },
  })

if (process.env.NODE_ENV !== "production") {
  globalForDb.dbClient = client
}

export const db = drizzle(client, { schema })