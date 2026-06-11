import { NextRequest } from "next/server"
import {
  requireUploadContext,
  storageObjectPath,
  uploadFileToBucket,
  validateUploadFile,
} from "@/lib/supabase/storage-upload"
import { PRODUCT_IMAGES_BUCKET, PRODUCT_VIDEOS_BUCKET } from "@/lib/supabase/server"

/** Allowed image MIME types for product uploads */
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]
/** Allowed video MIME types for product uploads */
const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime", // .mov
]
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB
const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024 // 50 MB

/** Only authenticated users can upload. Public (unauthenticated) users are rejected. */
export async function POST(request: NextRequest) {
  try {
    const { ctx, error } = await requireUploadContext(request)
    if (error) return error

    const formData = await request.formData()
    const type = formData.get("type")?.toString()?.toLowerCase()
    if (type !== "image" && type !== "video") {
      return Response.json(
        { error: "Missing or invalid type. Use type=image or type=video." },
        { status: 400 }
      )
    }

    const files: File[] = []
    const fileList = formData.getAll("files")
    if (fileList.length === 0) {
      const single = formData.get("file")
      if (single instanceof File) files.push(single)
    } else {
      for (const f of fileList) {
        if (f instanceof File) files.push(f)
      }
    }
    if (files.length === 0) {
      return Response.json({ error: "No files provided." }, { status: 400 })
    }

    const bucket = type === "image" ? PRODUCT_IMAGES_BUCKET : PRODUCT_VIDEOS_BUCKET
    const allowedTypes = type === "image" ? ALLOWED_IMAGE_TYPES : ALLOWED_VIDEO_TYPES
    const maxSize = type === "image" ? MAX_IMAGE_SIZE_BYTES : MAX_VIDEO_SIZE_BYTES
    const fallbackExt = type === "image" ? "jpg" : "mp4"

    const urls: string[] = []
    for (const file of files) {
      const invalid = validateUploadFile(file, allowedTypes, maxSize)
      if (invalid) return invalid

      const result = await uploadFileToBucket(ctx.supabase, {
        bucket,
        path: storageObjectPath(ctx.user.id, file, fallbackExt),
        file,
      })
      if (result.error) return result.error
      urls.push(result.url)
    }

    return Response.json({ urls })
  } catch (err) {
    console.error("POST /api/upload/product-media:", err)
    return Response.json({ error: "Upload failed" }, { status: 500 })
  }
}
