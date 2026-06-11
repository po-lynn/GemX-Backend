import { NextRequest } from "next/server"
import {
  requireUploadContext,
  storageObjectPath,
  uploadFileToBucket,
  validateUploadFile,
} from "@/lib/supabase/storage-upload"
import { PRODUCT_CERTIFICATES_BUCKET } from "@/lib/supabase/server"

/** Allowed MIME types for lab report / certificate uploads (PDF and images). */
const ALLOWED_CERT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]

const MAX_CERT_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

/** Single file upload. Authenticated users only. Returns the public URL for product certificate (stored in certReportUrl). */
export async function POST(request: NextRequest) {
  try {
    const { ctx, error } = await requireUploadContext(request)
    if (error) return error

    const formData = await request.formData()
    const file = formData.get("file")
    if (!(file instanceof File)) {
      return Response.json(
        { error: "No file provided. Use form field 'file'." },
        { status: 400 }
      )
    }

    const invalid = validateUploadFile(file, ALLOWED_CERT_TYPES, MAX_CERT_SIZE_BYTES)
    if (invalid) return invalid

    const fallbackExt = file.type === "application/pdf" ? "pdf" : "jpg"
    const result = await uploadFileToBucket(ctx.supabase, {
      bucket: PRODUCT_CERTIFICATES_BUCKET,
      path: storageObjectPath(ctx.user.id, file, fallbackExt),
      file,
    })
    if (result.error) return result.error

    return Response.json({ url: result.url })
  } catch (err) {
    console.error("POST /api/upload/certificate:", err)
    return Response.json({ error: "Upload failed" }, { status: 500 })
  }
}
