import { NextRequest, connection } from "next/server"
import { auth } from "@/lib/auth"
import { canAdminManageProducts } from "@/features/products/permissions/products"
import {
  CATEGORY_IMAGES_BUCKET,
  getSupabaseAdmin,
  getSupabaseAdminErrorMessage,
} from "@/lib/supabase/server"

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
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user?.id) {
      return Response.json(
        { error: "Unauthorized. Sign in to upload files." },
        { status: 401 }
      )
    }
    if (!canAdminManageProducts(session.user.role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 })
    }

    const supabase = getSupabaseAdmin()
    if (!supabase) {
      return Response.json({ error: getSupabaseAdminErrorMessage() }, { status: 503 })
    }

    const formData = await request.formData()
    const file = formData.get("file")
    if (!(file instanceof File)) {
      return Response.json({ error: "No file provided." }, { status: 400 })
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return Response.json(
        { error: `Invalid file type. Allowed: ${ALLOWED_IMAGE_TYPES.join(", ")}` },
        { status: 400 }
      )
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return Response.json(
        {
          error: `File too large. Max size: ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024} MB`,
        },
        { status: 400 }
      )
    }

    const ext = file.name.split(".").pop() || "jpg"
    const path = `${session.user.id}/${crypto.randomUUID()}.${ext}`
    const arrayBuffer = await file.arrayBuffer()

    let uploadResult = await supabase.storage
      .from(CATEGORY_IMAGES_BUCKET)
      .upload(path, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      })

    // If bucket does not exist, create it (public) and retry once
    if (uploadResult.error) {
      const isBucketNotFound =
        uploadResult.error.message?.includes("Bucket not found") ||
        (uploadResult.error as { statusCode?: string })?.statusCode === "404"
      if (isBucketNotFound) {
        const { error: createErr } = await supabase.storage.createBucket(
          CATEGORY_IMAGES_BUCKET,
          { public: true }
        )
        if (!createErr) {
          uploadResult = await supabase.storage
            .from(CATEGORY_IMAGES_BUCKET)
            .upload(path, arrayBuffer, {
              contentType: file.type,
              upsert: false,
            })
        }
      }
    }

    if (uploadResult.error) {
      console.error("Supabase storage category image upload error:", uploadResult.error)
      const isRls =
        uploadResult.error.message?.includes("row-level security") ||
        uploadResult.error.message?.includes("violates")
      const message = isRls
        ? "Storage RLS blocked upload. Set SUPABASE_SERVICE_ROLE_KEY in .env.local to the service_role secret (Supabase → Project Settings → API → service_role), not the anon key. Restart the dev server. Ensure the category-images bucket exists and RLS policies are applied."
        : (uploadResult.error.message || "Upload failed")
      return Response.json({ error: message }, { status: 500 })
    }

    const { data: urlData } = supabase.storage
      .from(CATEGORY_IMAGES_BUCKET)
      .getPublicUrl(path)

    return Response.json({ url: urlData.publicUrl })
  } catch (err) {
    console.error("POST /api/categories/image:", err)
    return Response.json({ error: "Upload failed" }, { status: 500 })
  }
}

