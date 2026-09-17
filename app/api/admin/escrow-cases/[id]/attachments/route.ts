import { NextRequest, connection } from "next/server"
import { z } from "zod"
import {
  requireUploadContext,
  storageObjectPath,
  uploadFileToBucket,
  validateUploadFile,
} from "@/lib/supabase/storage-upload"
import { ESCROW_EVIDENCE_BUCKET } from "@/lib/supabase/server"
import { jsonError, jsonUncached } from "@/lib/api"
import { requireEscrowCaseAccess, requireEscrowThreadWriteAccess } from "@/features/escrow-cases/lib/case-access"
import {
  createEscrowCaseAttachment,
  listEscrowCaseAttachments,
  type EscrowCaseAttachmentFileType,
} from "@/features/escrow-cases/db/case-attachments"

const ALLOWED_EVIDENCE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]
const MAX_EVIDENCE_SIZE_BYTES = 20 * 1024 * 1024 // 20 MB, matches /api/chat/media

const labelSchema = z.object({ label: z.string().trim().max(200).optional() })

function fileTypeFromMime(mime: string): EscrowCaseAttachmentFileType {
  return mime.startsWith("image/") ? "image" : "file"
}

/** GET /api/admin/escrow-cases/[id]/attachments — any access scope may read, including
 *  read-only "moderation" oversight (reviewing evidence is part of overseeing a case). */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  await connection()
  const { id } = await context.params
  const access = await requireEscrowCaseAccess(request, id)
  if (!access.ok) return access.error

  try {
    const attachments = await listEscrowCaseAttachments(id)
    return jsonUncached({ success: true, attachments })
  } catch (error) {
    console.error("GET /api/admin/escrow-cases/[id]/attachments:", error)
    return jsonError("Failed to load attachments", 500)
  }
}

/**
 * POST /api/admin/escrow-cases/[id]/attachments — uploads one evidence file (photo,
 * certificate, payment slip) and links it to the CASE, not only a message (item 6 of
 * the brief's scope: evidence must survive a message being edited/removed). Rejects the
 * read-only "moderation" scope, same as sending a message — a moderator reviews
 * evidence, never adds to it.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  await connection()
  const { id } = await context.params
  const access = await requireEscrowThreadWriteAccess(request, id)
  if (!access.ok) return access.error

  try {
    const { ctx, error } = await requireUploadContext(request)
    if (error) return error

    const formData = await request.formData()
    const file = formData.get("file")
    if (!(file instanceof File)) return jsonError("No file provided.", 400)

    const label = labelSchema.safeParse({ label: formData.get("label") ?? undefined })
    if (!label.success) return jsonError("Invalid input", 400)

    const invalid = await validateUploadFile(file, ALLOWED_EVIDENCE_TYPES, MAX_EVIDENCE_SIZE_BYTES)
    if (invalid) return invalid

    const uploaded = await uploadFileToBucket(ctx.supabase, {
      bucket: ESCROW_EVIDENCE_BUCKET,
      path: storageObjectPath(ctx.user.id, file, "bin", { timestamped: true }),
      file,
      createBucketIfMissing: true,
    })
    if (uploaded.error) return uploaded.error

    const attachment = await createEscrowCaseAttachment({
      caseId: id,
      uploadedByUserId: access.session.user.id,
      url: uploaded.url,
      fileType: fileTypeFromMime(file.type),
      label: label.data.label ?? null,
    })

    return jsonUncached({ success: true, attachment })
  } catch (error) {
    console.error("POST /api/admin/escrow-cases/[id]/attachments:", error)
    return jsonError("Failed to upload attachment", 500)
  }
}
