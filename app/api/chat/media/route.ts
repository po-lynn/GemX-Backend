import { NextRequest, connection } from "next/server";
import { auth } from "@/lib/auth";
import {
  CHAT_MEDIA_BUCKET,
  getSupabaseAdmin,
  getSupabaseAdminErrorMessage,
} from "@/lib/supabase/server";
import { jsonError, jsonUncached } from "@/lib/api";

const ALLOWED_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "audio/webm",
  "audio/mpeg",
  "audio/mp4",
  "audio/aac",
  "audio/ogg",
  "audio/wav",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_MEDIA_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

/**
 * POST /api/chat/media
 * Upload one chat media file and return public URL for websocket message payload.
 */
export async function POST(request: NextRequest) {
  await connection();
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) return jsonError("Unauthorized", 401);

    const supabase = getSupabaseAdmin();
    if (!supabase) return jsonError(getSupabaseAdminErrorMessage(), 503);

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return jsonError("No file provided.", 400);

    if (!ALLOWED_MEDIA_TYPES.includes(file.type)) {
      return jsonError(`Invalid file type: ${file.type || "unknown"}`, 400);
    }
    if (file.size > MAX_MEDIA_SIZE_BYTES) {
      return jsonError(`File too large. Max size: ${MAX_MEDIA_SIZE_BYTES / 1024 / 1024} MB`, 400);
    }

    const ext = file.name.split(".").pop() || "bin";
    const path = `${session.user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    let uploadResult = await supabase.storage.from(CHAT_MEDIA_BUCKET).upload(path, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });

    if (uploadResult.error) {
      const bucketMissing =
        uploadResult.error.message?.includes("Bucket not found") ||
        (uploadResult.error as { statusCode?: string }).statusCode === "404";
      if (bucketMissing) {
        const { error: createErr } = await supabase.storage.createBucket(CHAT_MEDIA_BUCKET, {
          public: true,
        });
        if (!createErr) {
          uploadResult = await supabase.storage.from(CHAT_MEDIA_BUCKET).upload(path, arrayBuffer, {
            contentType: file.type,
            upsert: false,
          });
        }
      }
    }

    if (uploadResult.error) {
      console.error("POST /api/chat/media upload:", uploadResult.error);
      return jsonError(uploadResult.error.message || "Upload failed", 500);
    }

    const { data } = supabase.storage.from(CHAT_MEDIA_BUCKET).getPublicUrl(path);
    return jsonUncached({ url: data.publicUrl });
  } catch (error) {
    console.error("POST /api/chat/media:", error);
    return jsonError("Failed to upload media", 500);
  }
}

