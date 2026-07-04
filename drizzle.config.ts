import "dotenv/config"
import { config } from "dotenv"
import { defineConfig } from "drizzle-kit"

config({ path: ".env.local", override: true })

const dbCredentials = process.env.DIRECT_URL
  ? { url: process.env.DIRECT_URL }
  : process.env.DATABASE_URL
    ? { url: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST!,
        user: process.env.DB_USER!,
        database: process.env.DB_NAME!,
        password: process.env.DB_PASSWORD!,
        ssl: process.env.DB_SSL === "true",
        onnotice: false,
      }

export default defineConfig({
  out: "./drizzle/migrations",
  schema: "./drizzle/schema.ts",
  dialect: "postgresql",
  strict: true,
  verbose: true,
  dbCredentials,
})