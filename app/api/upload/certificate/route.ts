import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import {
  getSupabaseAdmin,
  getSupabaseAdminErrorMessage,
  PRODUCT_CERTIFICATES_BUCKET,
} from "@/lib/supabase/server"

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
    const file = formData.get("file")
    if (!(file instanceof File)) {
      return Response.json(
        { error: "No file provided. Use form field 'file'." },
        { status: 400 }
      )
    }

    if (!ALLOWED_CERT_TYPES.includes(file.type)) {
      return Response.json(
        {
          error: `Invalid file type: ${file.name}. Allowed: ${ALLOWED_CERT_TYPES.join(", ")}`,
        },
        { status: 400 }
      )
    }
    if (file.size > MAX_CERT_SIZE_BYTES) {
      return Response.json(
        {
          error: `File too large: ${file.name}. Max size: ${MAX_CERT_SIZE_BYTES / 1024 / 1024} MB`,
        },
        { status: 400 }
      )
    }

    const ext = file.name.split(".").pop() || (file.type === "application/pdf" ? "pdf" : "jpg")
    const path = `${session.user.id}/${crypto.randomUUID()}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const { error } = await supabase.storage
      .from(PRODUCT_CERTIFICATES_BUCKET)
      .upload(path, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      })

    if (error) {
      console.error("Supabase storage certificate upload error:", error)
      const isRls =
        error.message?.includes("row-level security") || error.message?.includes("violates")
      const message = isRls
        ? "Storage RLS blocked upload. Set SUPABASE_SERVICE_ROLE_KEY in .env.local to the service_role secret (Supabase → Project Settings → API → service_role), not the anon key. Restart the dev server. Ensure the product-certificates bucket exists and RLS policies are applied (see scripts/supabase-storage-policies.sql)."
        : (error.message || "Upload failed")
      return Response.json({ error: message }, { status: 500 })
    }

    const { data: urlData } = supabase.storage
      .from(PRODUCT_CERTIFICATES_BUCKET)
      .getPublicUrl(path)

    return Response.json({ url: urlData.publicUrl })
  } catch (err) {
    console.error("POST /api/upload/certificate:", err)
    return Response.json({ error: "Upload failed" }, { status: 500 })
  }
}
