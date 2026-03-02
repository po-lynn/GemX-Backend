import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { getSupabaseAdmin, getSupabaseAdminErrorMessage, PRODUCT_IMAGES_BUCKET, PRODUCT_VIDEOS_BUCKET } from "@/lib/supabase/server"

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
const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024 // 100 MB

/** Only authenticated users can upload. Public (unauthenticated) users are rejected. */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user?.id) {
      return Response.json(
        { error: "Unauthorized. Sign in to upload files." },
        { status: 401 }
      )
    }

    const supabase = getSupabaseAdmin()
    if (!supabase) {
      return Response.json(
        { error: getSupabaseAdminErrorMessage() },
        { status: 503 }
      )
    }

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

    const urls: string[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!allowedTypes.includes(file.type)) {
        return Response.json(
          { error: `Invalid file type: ${file.name}. Allowed: ${allowedTypes.join(", ")}` },
          { status: 400 }
        )
      }
      if (file.size > maxSize) {
        return Response.json(
          { error: `File too large: ${file.name}. Max size: ${maxSize / 1024 / 1024} MB` },
          { status: 400 }
        )
      }

      const ext = file.name.split(".").pop() || (type === "image" ? "jpg" : "mp4")
      const path = `${session.user.id}/${crypto.randomUUID()}.${ext}`

      const arrayBuffer = await file.arrayBuffer()
      const { error } = await supabase.storage.from(bucket).upload(path, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      })

      if (error) {
        console.error("Supabase storage upload error:", error)
        const isRls = error.message?.includes("row-level security") || error.message?.includes("violates")
        const message = isRls
          ? "Storage RLS blocked upload. Set SUPABASE_SERVICE_ROLE_KEY in .env.local to the service_role secret (Supabase → Project Settings → API → service_role), not the anon key. Restart the dev server."
          : (error.message || "Upload failed")
        return Response.json(
          { error: message },
          { status: 500 }
        )
      }

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path)
      urls.push(urlData.publicUrl)
    }

    return Response.json({ urls })
  } catch (err) {
    console.error("POST /api/upload/product-media:", err)
    return Response.json({ error: "Upload failed" }, { status: 500 })
  }
}
