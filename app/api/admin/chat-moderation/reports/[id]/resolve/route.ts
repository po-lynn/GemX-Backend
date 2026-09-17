import { NextRequest, connection } from "next/server"
import { z } from "zod"
import { requireAdminOrFeature } from "@/lib/api-guard"
import { jsonError, jsonUncached } from "@/lib/api"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import {
  MessageReportAlreadyResolvedError,
  MessageReportNotFoundError,
  resolveMessageReport,
} from "@/features/chat-moderation/db/reports"
import { messageReportResolutionEnum } from "@/drizzle/schema/chat-moderation-schema"

const resolveSchema = z.object({
  action: z.enum(messageReportResolutionEnum.enumValues),
  reason: z.string().trim().min(1).max(1000),
})

/**
 * POST /api/admin/chat-moderation/reports/[id]/resolve — one of dismiss/warn/
 * delete_message/mute_user/ban_user, each with a mandatory reason (per the brief).
 * "warn" has no further side effect today beyond recording the resolution — there's
 * no in-app warning/notification surface to send it through yet.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  await connection()
  const gate = await requireAdminOrFeature(request, FEATURE_KEYS.CHAT_MODERATION)
  if ("error" in gate) return gate.error

  try {
    const { id } = await context.params
    const parsed = resolveSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return jsonError("Invalid input", 400)

    await resolveMessageReport({
      reportId: id,
      action: parsed.data.action,
      reason: parsed.data.reason,
      resolvedByAdminId: gate.session.user.id,
    })
    return jsonUncached({ success: true })
  } catch (error) {
    if (error instanceof MessageReportNotFoundError) return jsonError("Not found", 404)
    if (error instanceof MessageReportAlreadyResolvedError) return jsonError("Report was already resolved", 409)
    console.error("POST /api/admin/chat-moderation/reports/[id]/resolve:", error)
    return jsonError("Failed to resolve report", 500)
  }
}
