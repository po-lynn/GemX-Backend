 
import { defineConfig } from "drizzle-kit"

export default defineConfig({
  out: "./drizzle/migrations",
  schema: "./drizzle/schema.ts",
  dialect: "postgresql",
  strict: true,
  verbose: true,
  dbCredentials: {
    password: process.env.DB_PASSWORD!,
    user: process.env.DB_USER!,
    database: process.env.DB_NAME!,
    host: process.env.DB_HOST!,
    ssl: false,
    // Passed through to postgres.js; silences NOTICE (e.g. "schema already exists")
    // @ts-expect-error - drizzle-kit types omit postgres.js options; onnotice is valid at runtime
    onnotice: false,
  },
})
