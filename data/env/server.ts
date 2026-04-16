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

/** Optional: for push notifications to mobile app (FCM). */
const firebaseSchema = {
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().email().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
}

/** Optional: Azure Translator (required only when auto-translating news). */
const azureTranslatorSchema = {
  AZURE_TRANSLATOR_KEY: z.string().optional(),
  AZURE_TRANSLATOR_REGION: z.string().optional(),
  AZURE_TRANSLATOR_ENDPOINT: z.string().url().optional(),
}

export const env = createEnv({
  server: {
    ...dbSchema,
    ...firebaseSchema,
    ...azureTranslatorSchema,
    AUTH_SECRET: z.string().min(1),
    AUTH_URL: z.string().min(1),
  },
  experimental__runtimeEnv: process.env,
})
