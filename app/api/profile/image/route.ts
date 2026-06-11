import { NextRequest, connection } from "next/server";
import {
  requireUploadContext,
  storageObjectPath,
  uploadFileToBucket,
  validateUploadFile,
} from "@/lib/supabase/storage-upload";
import { USER_IMAGES_BUCKET } from "@/lib/supabase/server";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * POST /api/profile/image
 * Upload one profile image and return a public URL.
 */
export async function POST(request: NextRequest) {
  await connection();
  try {
    const { ctx, error } = await requireUploadContext(request);
    if (error) return error;

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "No file provided." }, { status: 400 });
    }

    const invalid = validateUploadFile(file, ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES);
    if (invalid) return invalid;

    const result = await uploadFileToBucket(ctx.supabase, {
      bucket: USER_IMAGES_BUCKET,
      path: storageObjectPath(ctx.user.id, file, "jpg"),
      file,
      createBucketIfMissing: true,
    });
    if (result.error) return result.error;

    return Response.json({ url: result.url });
  } catch (error) {
    console.error("POST /api/profile/image:", error);
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }
}
