import { NextRequest, connection } from "next/server";
import {
  requireUploadContext,
  storageObjectPath,
  uploadFileToBucket,
  validateUploadFile,
} from "@/lib/supabase/storage-upload";
import { CHAT_MEDIA_BUCKET } from "@/lib/supabase/server";
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
    const { ctx, error } = await requireUploadContext(request);
    if (error) return error;

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return jsonError("No file provided.", 400);

    const invalid = await validateUploadFile(file, ALLOWED_MEDIA_TYPES, MAX_MEDIA_SIZE_BYTES);
    if (invalid) return invalid;

    const result = await uploadFileToBucket(ctx.supabase, {
      bucket: CHAT_MEDIA_BUCKET,
      path: storageObjectPath(ctx.user.id, file, "bin", { timestamped: true }),
      file,
      createBucketIfMissing: true,
    });
    if (result.error) return result.error;

    return jsonUncached({ url: result.url });
  } catch (error) {
    console.error("POST /api/chat/media:", error);
    return jsonError("Failed to upload media", 500);
  }
}
