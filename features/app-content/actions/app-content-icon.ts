"use server"

import { requireActionRole } from "@/lib/action-guard"
import { canManageAppContent } from "@/features/app-content/permissions/app-content"
import {
  APP_CONTENT_ICONS_BUCKET,
  getSupabaseAdmin,
  getSupabaseAdminErrorMessage,
} from "@/lib/supabase/server"
import {
  storageObjectPath,
  uploadFileToBucket,
  validateUploadFile,
} from "@/lib/supabase/storage-upload"

const ALLOWED_ICON_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
const MAX_ICON_SIZE_BYTES = 2 * 1024 * 1024 // 2 MB

async function errorMessageFrom(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json()
    return typeof body?.error === "string" ? body.error : fallback
  } catch {
    return fallback
  }
}

/** Uploads a custom Follow Us platform icon. Admin only. */
export async function uploadAppContentIconAction(
  formData: FormData
): Promise<{ url: string } | { error: string }> {
  const session = await requireActionRole(canManageAppContent)
  if (!session) return { error: "Unauthorized" }

  const file = formData.get("file")
  if (!(file instanceof File)) return { error: "No file provided" }

  const invalidResponse = await validateUploadFile(file, ALLOWED_ICON_TYPES, MAX_ICON_SIZE_BYTES)
  if (invalidResponse) return { error: await errorMessageFrom(invalidResponse, "Invalid file") }

  const supabase = getSupabaseAdmin()
  if (!supabase) return { error: getSupabaseAdminErrorMessage() }

  const result = await uploadFileToBucket(supabase, {
    bucket: APP_CONTENT_ICONS_BUCKET,
    path: storageObjectPath(session.user.id, file, "png"),
    file,
    createBucketIfMissing: true,
  })
  if (result.error) return { error: await errorMessageFrom(result.error, "Upload failed") }

  return { url: result.url }
}
