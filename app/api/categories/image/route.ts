import { NextRequest, connection } from "next/server"
import { canAdminManageProducts } from "@/features/products/permissions/products"
import { jsonError } from "@/lib/api"
import {
  requireUploadContext,
  storageObjectPath,
  uploadFileToBucket,
  validateUploadFile,
} from "@/lib/supabase/storage-upload"
import { CATEGORY_IMAGES_BUCKET } from "@/lib/supabase/server"

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

/**
 * POST /api/categories/image
 * Upload one category image and return a public URL for category.image.
 * Admin-only (session auth).
 */
export async function POST(request: NextRequest) {
  await connection()
  try {
    const { ctx, error } = await requireUploadContext(request)
    if (error) return error
    if (!canAdminManageProducts(ctx.user.role)) {
      return jsonError("Forbidden", 403)
    }

    const formData = await request.formData()
    const file = formData.get("file")
    if (!(file instanceof File)) {
      return Response.json({ error: "No file provided." }, { status: 400 })
    }

    const invalid = await validateUploadFile(file, ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES)
    if (invalid) return invalid

    const result = await uploadFileToBucket(ctx.supabase, {
      bucket: CATEGORY_IMAGES_BUCKET,
      path: storageObjectPath(ctx.user.id, file, "jpg"),
      file,
      createBucketIfMissing: true,
    })
    if (result.error) return result.error

    return Response.json({ url: result.url })
  } catch (err) {
    console.error("POST /api/categories/image:", err)
    return Response.json({ error: "Upload failed" }, { status: 500 })
  }
}
