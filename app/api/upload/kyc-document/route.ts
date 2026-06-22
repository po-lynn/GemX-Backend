import { NextRequest } from "next/server"
import {
  requireUploadContext,
  storageObjectPath,
  uploadFileToBucket,
  validateUploadFile,
} from "@/lib/supabase/storage-upload"
import { KYC_DOCUMENTS_BUCKET } from "@/lib/supabase/server"

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]
const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

export async function POST(request: NextRequest) {
  try {
    const { ctx, error } = await requireUploadContext(request)
    if (error) return error

    const formData = await request.formData()
    const file = formData.get("file")
    if (!(file instanceof File)) {
      return Response.json({ error: "No file provided." }, { status: 400 })
    }

    const invalid = validateUploadFile(file, ALLOWED_TYPES, MAX_SIZE_BYTES)
    if (invalid) return invalid

    const result = await uploadFileToBucket(ctx.supabase, {
      bucket: KYC_DOCUMENTS_BUCKET,
      path: storageObjectPath(ctx.user.id, file, "jpg"),
      file,
      createBucketIfMissing: true,
    })
    if (result.error) return result.error

    return Response.json({ url: result.url })
  } catch (err) {
    console.error("POST /api/upload/kyc-document:", err)
    return Response.json({ error: "Upload failed" }, { status: 500 })
  }
}
