import { NextRequest, connection } from "next/server"
import { z } from "zod"
import { requireAdminOrFeature } from "@/lib/api-guard"
import { jsonError, jsonUncached } from "@/lib/api"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { createMessageReport, listMessageReports } from "@/features/chat-moderation/db/reports"
import { messageReportStatusEnum } from "@/drizzle/schema/chat-moderation-schema"

const createSchema = z
  .object({
    flatMessageId: z.string().trim().min(1).optional(),
    caseMessageId: z.string().trim().min(1).optional(),
    reason: z.string().trim().min(1).max(1000),
    contentSnapshot: z.string().trim().min(1).max(5000),
  })
  .refine((v) => !!v.flatMessageId !== !!v.caseMessageId, {
    message: "Exactly one of flatMessageId or caseMessageId is required",
  })

/** GET /api/admin/chat-moderation/reports?status=open|dismissed|actioned — the reports queue. */
export async function GET(request: NextRequest) {
  await connection()
  const gate = await requireAdminOrFeature(request, FEATURE_KEYS.CHAT_MODERATION)
  if ("error" in gate) return gate.error

  try {
    const statusParam = new URL(request.url).searchParams.get("status")
    const status = statusParam && (messageReportStatusEnum.enumValues as string[]).includes(statusParam)
      ? (statusParam as (typeof messageReportStatusEnum.enumValues)[number])
      : undefined
    const reports = await listMessageReports({ status })
    return jsonUncached({ success: true, reports })
  } catch (error) {
    console.error("GET /api/admin/chat-moderation/reports:", error)
    return jsonError("Failed to load reports", 500)
  }
}

/**
 * POST /api/admin/chat-moderation/reports — files a report while reviewing a thread.
 * There is no mobile "report this message" endpoint yet (out of scope for this
 * admin-backend-only task — see docs/technical), so today `reporterId` is always the
 * moderator/staff session filing it, not an end user.
 */
export async function POST(request: NextRequest) {
  await connection()
  const gate = await requireAdminOrFeature(request, FEATURE_KEYS.CHAT_MODERATION)
  if ("error" in gate) return gate.error

  try {
    const parsed = createSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return jsonError("Invalid input", 400)

    const report = await createMessageReport({
      flatMessageId: parsed.data.flatMessageId,
      caseMessageId: parsed.data.caseMessageId,
      reporterId: gate.session.user.id,
      reason: parsed.data.reason,
      contentSnapshot: parsed.data.contentSnapshot,
    })
    return jsonUncached({ success: true, report })
  } catch (error) {
    console.error("POST /api/admin/chat-moderation/reports:", error)
    return jsonError("Failed to create report", 500)
  }
}
