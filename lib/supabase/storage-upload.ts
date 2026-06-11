import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { jsonError } from "@/lib/api"
import { getSupabaseAdmin, getSupabaseAdminErrorMessage } from "@/lib/supabase/server"

type SupabaseAdminClient = NonNullable<ReturnType<typeof getSupabaseAdmin>>

type SessionUser = { id: string; role: string; [key: string]: unknown }

export type UploadContext = {
  user: SessionUser
  supabase: SupabaseAdminClient
}

type UploadContextResult =
  | { ctx: UploadContext; error?: never }
  | { error: Response; ctx?: never }

/**
 * Resolve the authenticated session and Supabase admin client for an upload route.
 * Returns a ready-to-return 401/503 Response on failure.
 */
export async function requireUploadContext(
  request: NextRequest
): Promise<UploadContextResult> {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user?.id) {
    return { error: jsonError("Unauthorized. Sign in to upload files.", 401) }
  }
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return { error: jsonError(getSupabaseAdminErrorMessage(), 503) }
  }
  return { ctx: { user: session.user as SessionUser, supabase } }
}

/** Validate MIME type and size; returns a 400 Response on failure, null when valid. */
export function validateUploadFile(
  file: File,
  allowedTypes: readonly string[],
  maxSizeBytes: number
): Response | null {
  if (!allowedTypes.includes(file.type)) {
    return jsonError(
      `Invalid file type: ${file.name}. Allowed: ${allowedTypes.join(", ")}`,
      400
    )
  }
  if (file.size > maxSizeBytes) {
    return jsonError(
      `File too large: ${file.name}. Max size: ${maxSizeBytes / 1024 / 1024} MB`,
      400
    )
  }
  return null
}

/** Storage object path: `<userId>/<uuid>.<ext>` (ext from file name, else fallback). */
export function storageObjectPath(
  userId: string,
  file: File,
  fallbackExt: string,
  opts?: { timestamped?: boolean }
): string {
  const dotIndex = file.name.lastIndexOf(".")
  const ext = dotIndex > 0 ? file.name.slice(dotIndex + 1) : fallbackExt
  const name = opts?.timestamped
    ? `${Date.now()}-${crypto.randomUUID()}`
    : crypto.randomUUID()
  return `${userId}/${name}.${ext}`
}

type StorageError = { message?: string; statusCode?: string }

function isBucketNotFound(error: StorageError): boolean {
  return (
    error.message?.includes("Bucket not found") || error.statusCode === "404"
  )
}

/** User-facing message for a failed storage upload; explains the RLS misconfiguration case. */
function uploadErrorMessage(error: StorageError, bucket: string): string {
  const isRls =
    error.message?.includes("row-level security") ||
    error.message?.includes("violates")
  return isRls
    ? `Storage RLS blocked upload. Set SUPABASE_SERVICE_ROLE_KEY in .env.local to the service_role secret (Supabase → Project Settings → API → service_role), not the anon key. Restart the dev server. Ensure the ${bucket} bucket exists and RLS policies are applied (see scripts/supabase-storage-policies.sql).`
    : error.message || "Upload failed"
}

type UploadFileResult =
  | { url: string; error?: never }
  | { error: Response; url?: never }

/**
 * Upload one file to a bucket and return its public URL.
 * With `createBucketIfMissing`, a missing bucket is created (public) and the upload retried once.
 */
export async function uploadFileToBucket(
  supabase: SupabaseAdminClient,
  opts: {
    bucket: string
    path: string
    file: File
    createBucketIfMissing?: boolean
  }
): Promise<UploadFileResult> {
  const { bucket, path, file, createBucketIfMissing = false } = opts
  const arrayBuffer = await file.arrayBuffer()
  const upload = () =>
    supabase.storage.from(bucket).upload(path, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    })

  let result = await upload()
  if (result.error && createBucketIfMissing && isBucketNotFound(result.error)) {
    const { error: createErr } = await supabase.storage.createBucket(bucket, {
      public: true,
    })
    if (!createErr) {
      result = await upload()
    }
  }

  if (result.error) {
    console.error(`Supabase storage upload error (${bucket}):`, result.error)
    return { error: jsonError(uploadErrorMessage(result.error, bucket), 500) }
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return { url: data.publicUrl }
}
