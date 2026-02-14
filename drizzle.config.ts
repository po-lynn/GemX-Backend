import "dotenv/config"
import { defineConfig } from "drizzle-kit"

/** Use DATABASE_URL (Supabase/Vercel) or DB_HOST + DB_USER + DB_NAME + DB_PASSWORD (local). */
const dbCredentials = process.env.DATABASE_URL
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
