import { NextRequest, connection } from "next/server"
import { z } from "zod"
import { requireAdminOrFeature } from "@/lib/api-guard"
import { jsonError, jsonUncached } from "@/lib/api"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { issueRestriction, listRestrictions } from "@/features/chat-moderation/db/restrictions"
import { messagingRestrictionTypeEnum } from "@/drizzle/schema/chat-moderation-schema"

const createSchema = z.object({
  userId: z.string().trim().min(1),
  restrictionType: z.enum(messagingRestrictionTypeEnum.enumValues),
  reason: z.string().trim().min(1).max(1000),
  // Duration in hours for a mute; omitted/null = indefinite (required shape for a ban).
  durationHours: z.number().int().positive().max(24 * 365).optional(),
})

/** GET /api/admin/chat-moderation/restrictions?userId=<id>&activeOnly=true — the user-messaging-controls list. */
export async function GET(request: NextRequest) {
  await connection()
  const gate = await requireAdminOrFeature(request, FEATURE_KEYS.CHAT_MODERATION)
  if ("error" in gate) return gate.error

  try {
    const params = new URL(request.url).searchParams
    const userId = params.get("userId") ?? undefined
    const activeOnly = params.get("activeOnly") !== "false"
    const restrictions = await listRestrictions({ userId, activeOnly })
    return jsonUncached({ success: true, restrictions })
  } catch (error) {
    console.error("GET /api/admin/chat-moderation/restrictions:", error)
    return jsonError("Failed to load restrictions", 500)
  }
}

/** POST /api/admin/chat-moderation/restrictions — mute (duration) or ban (indefinite), each with a mandatory reason. */
export async function POST(request: NextRequest) {
  await connection()
  const gate = await requireAdminOrFeature(request, FEATURE_KEYS.CHAT_MODERATION)
  if ("error" in gate) return gate.error

  try {
    const parsed = createSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return jsonError("Invalid input", 400)
    if (parsed.data.restrictionType === "mute" && !parsed.data.durationHours) {
      return jsonError("durationHours is required for a mute", 400)
    }

    const expiresAt =
      parsed.data.restrictionType === "mute" && parsed.data.durationHours
        ? new Date(Date.now() + parsed.data.durationHours * 60 * 60 * 1000)
        : null

    const restriction = await issueRestriction({
      userId: parsed.data.userId,
      restrictionType: parsed.data.restrictionType,
      reason: parsed.data.reason,
      expiresAt,
      issuedByAdminId: gate.session.user.id,
    })
    return jsonUncached({ success: true, restriction })
  } catch (error) {
    console.error("POST /api/admin/chat-moderation/restrictions:", error)
    return jsonError("Failed to issue restriction", 500)
  }
}
