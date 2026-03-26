import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import {
  getSupabaseAdmin,
  getSupabaseAdminErrorMessage,
  PRODUCT_IMAGES_BUCKET,
  PRODUCT_VIDEOS_BUCKET,
} from "@/lib/supabase/server"

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"]

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB
const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024 // 100 MB

function mimeToExtension(mimeType: string, fallback: string) {
  const mt = (mimeType || "").toLowerCase()
  if (mt === "image/jpeg") return "jpg"
  if (mt === "image/png") return "png"
  if (mt === "image/webp") return "webp"
  if (mt === "image/gif") return "gif"

  if (mt === "video/mp4") return "mp4"
  if (mt === "video/webm") return "webm"
  if (mt === "video/quicktime") return "mov"

  return fallback
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user?.id) {
      return Response.json(
        { error: "Unauthorized. Sign in to upload files." },
        { status: 401 },
      )
    }

    const supabase = getSupabaseAdmin()
    if (!supabase) {
      return Response.json(
        { error: getSupabaseAdminErrorMessage() },
        { status: 503 },
      )
    }

    const body = (await request.json().catch(() => null)) as {
      type?: unknown
      contentType?: unknown
      size?: unknown
      fileSize?: unknown
      filename?: unknown
    } | null
    const type = String(body?.type || "").toLowerCase()
    const contentType = String(body?.contentType || "").toLowerCase()
    const size = Number(body?.size ?? body?.fileSize ?? NaN)
    const filename = String(body?.filename || "")

    if (type !== "image" && type !== "video") {
      return Response.json(
        { error: "Missing or invalid type. Use type=image or type=video." },
        { status: 400 },
      )
    }
    if (!contentType) {
      return Response.json(
        { error: "Missing contentType." },
        { status: 400 },
      )
    }
    if (!Number.isFinite(size) || size <= 0) {
      return Response.json(
        { error: "Missing or invalid size." },
        { status: 400 },
      )
    }

    const bucket =
      type === "image" ? PRODUCT_IMAGES_BUCKET : PRODUCT_VIDEOS_BUCKET
    const allowedTypes = type === "image" ? ALLOWED_IMAGE_TYPES : ALLOWED_VIDEO_TYPES
    const maxSize = type === "image" ? MAX_IMAGE_SIZE_BYTES : MAX_VIDEO_SIZE_BYTES

    if (!allowedTypes.includes(contentType)) {
      return Response.json(
        { error: `Invalid contentType. Allowed: ${allowedTypes.join(", ")}` },
        { status: 400 },
      )
    }
    if (size > maxSize) {
      return Response.json(
        { error: `File too large. Max size: ${maxSize / 1024 / 1024} MB` },
        { status: 400 },
      )
    }

    const filenameExt = filename.includes(".") ? filename.split(".").pop() || "" : ""
    const ext = mimeToExtension(contentType, filenameExt || (type === "image" ? "jpg" : "mp4"))

    const path = `${session.user.id}/${crypto.randomUUID()}.${ext}`

    // Signed upload token (used by the client to upload directly to Supabase Storage).
    const { data: signedData, error: signError } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(path)

    if (signError) {
      console.error("createSignedUploadUrl error:", signError)
      return Response.json(
        { error: signError.message || "Failed to sign upload." },
        { status: 500 },
      )
    }

    // Supabase signed upload returns a token used by `uploadToSignedUrl`.
    const token =
      signedData && typeof signedData === "object" && "token" in signedData
        ? (signedData.token as string | undefined) ?? null
        : null

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path)

    return Response.json({
      bucket,
      path,
      token,
      publicUrl: urlData.publicUrl,
      contentType,
      signedData, // keep raw payload for client debugging/compatibility
    })
  } catch (err) {
    console.error("POST /api/upload/product-media/sign:", err)
    return Response.json({ error: "Sign upload failed" }, { status: 500 })
  }
}

