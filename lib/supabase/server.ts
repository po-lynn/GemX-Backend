import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

/**
 * Server-side Supabase client with service role for Storage uploads.
 * Use only in API routes or server actions. Never expose service role key to the client.
 * Set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 * Must be the service_role secret (Project Settings → API), NOT the anon key, or Storage RLS will block uploads.
 */
export function getSupabaseAdmin() {
  if (!supabaseUrl || !supabaseServiceKey) {
    return null
  }
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (anonKey && supabaseServiceKey === anonKey) {
    return null
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  })
}

/** Call after getSupabaseAdmin() returns null to get a message for the user. */
export function getSupabaseAdminErrorMessage(): string {
  if (!supabaseUrl || !supabaseServiceKey) {
    return "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local."
  }
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (anonKey && supabaseServiceKey === anonKey) {
    return "SUPABASE_SERVICE_ROLE_KEY must be the service_role secret, not the anon key. In Supabase: Project Settings → API → service_role (secret). Copy that value into .env.local as SUPABASE_SERVICE_ROLE_KEY, then restart the dev server."
  }
  return "Supabase upload not configured."
}

/** Bucket names for product media (create these in Supabase Dashboard > Storage). */
export const PRODUCT_IMAGES_BUCKET = "product-images"
export const PRODUCT_VIDEOS_BUCKET = "product-videos"

/** Bucket for lab report / certificate files (PDF, images). Create in Supabase Dashboard > Storage. */
export const PRODUCT_CERTIFICATES_BUCKET = "product-certificates"

/** Bucket for user profile images (avatars). Create in Supabase Dashboard > Storage (public for direct links). */
export const USER_IMAGES_BUCKET = "user-images"
