// import { env } from "@/data/env/server"
// import { drizzle } from "drizzle-orm/node-postgres"
import * as schema from "./schema"

// export const db = drizzle({
//   schema,
//   connection: {
//     password: env.DB_PASSWORD,
//     user: env.DB_USER,
//     database: env.DB_NAME,
//     host: env.DB_HOST,
//   },
// })
import { env } from "@/data/env/server"
import postgres from "postgres"
import { drizzle } from "drizzle-orm/postgres-js"

const pool = postgres({
    host: env.DB_HOST,
    database: env.DB_NAME,
    username: env.DB_USER,
    password: env.DB_PASSWORD,
    max: 1,
})

export const db = drizzle(pool, { schema })