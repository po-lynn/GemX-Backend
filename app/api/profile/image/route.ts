import { NextRequest, connection } from "next/server";
import { auth } from "@/lib/auth";
import {
  getSupabaseAdmin,
  getSupabaseAdminErrorMessage,
  USER_IMAGES_BUCKET,
} from "@/lib/supabase/server";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * POST /api/profile/image
 * Upload one profile image and return a public URL.
 */
export async function POST(request: NextRequest) {
  await connection();
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized. Sign in to upload files." }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return Response.json({ error: getSupabaseAdminErrorMessage() }, { status: 503 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "No file provided." }, { status: 400 });
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return Response.json(
        { error: `Invalid file type. Allowed: ${ALLOWED_IMAGE_TYPES.join(", ")}` },
        { status: 400 }
      );
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return Response.json(
        { error: `File too large. Max size: ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024} MB` },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop() || "jpg";
    const path = `${session.user.id}/${crypto.randomUUID()}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();

    let uploadResult = await supabase.storage.from(USER_IMAGES_BUCKET).upload(path, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });

    if (uploadResult.error) {
      const isBucketNotFound =
        uploadResult.error.message?.includes("Bucket not found") ||
        (uploadResult.error as { statusCode?: string })?.statusCode === "404";
      if (isBucketNotFound) {
        const { error: createErr } = await supabase.storage.createBucket(USER_IMAGES_BUCKET, {
          public: true,
        });
        if (!createErr) {
          uploadResult = await supabase.storage.from(USER_IMAGES_BUCKET).upload(path, arrayBuffer, {
            contentType: file.type,
            upsert: false,
          });
        }
      }
    }

    if (uploadResult.error) {
      console.error("Supabase storage profile image upload error:", uploadResult.error);
      return Response.json({ error: uploadResult.error.message || "Upload failed" }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from(USER_IMAGES_BUCKET).getPublicUrl(path);
    return Response.json({ url: urlData.publicUrl });
  } catch (error) {
    console.error("POST /api/profile/image:", error);
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }
}
