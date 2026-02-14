import { createEnv } from "@t3-oss/env-nextjs"
import { z } from "zod"

/** Use DATABASE_URL (e.g. Supabase) or DB_HOST + DB_USER + DB_NAME + DB_PASSWORD (local). */
const dbSchema = {
  DATABASE_URL: z.string().url().optional(),
  DB_HOST: z.string().optional(),
  DB_USER: z.string().optional(),
  DB_NAME: z.string().optional(),
  DB_PASSWORD: z.string().optional(),
}

export const env = createEnv({
  server: {
    ...dbSchema,
    AUTH_SECRET: z.string().min(1),
    AUTH_URL: z.string().min(1),
    GITHUB_CLIENT_ID: z.string().min(1),
    GITHUB_CLIENT_SECRET: z.string().min(1),
    AUTH_GOOGLE_ID: z.string().min(1),
    AUTH_GOOGLE_SECRET: z.string().min(1),
  },
  experimental__runtimeEnv: process.env,
})
