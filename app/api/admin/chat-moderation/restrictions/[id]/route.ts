import { NextRequest, connection } from "next/server"
import { z } from "zod"
import { requireAdminOrFeature } from "@/lib/api-guard"
import { jsonError, jsonUncached } from "@/lib/api"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { liftRestriction, RestrictionNotFoundError } from "@/features/chat-moderation/db/restrictions"

const liftSchema = z.object({
  liftReason: z.string().trim().min(1).max(1000),
})

/** PATCH /api/admin/chat-moderation/restrictions/[id] — lift (restore) a mute or ban, with a mandatory reason. */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  await connection()
  const gate = await requireAdminOrFeature(request, FEATURE_KEYS.CHAT_MODERATION)
  if ("error" in gate) return gate.error

  try {
    const { id } = await context.params
    const parsed = liftSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return jsonError("Invalid input", 400)

    await liftRestriction({
      restrictionId: id,
      liftedByAdminId: gate.session.user.id,
      liftReason: parsed.data.liftReason,
    })
    return jsonUncached({ success: true })
  } catch (error) {
    if (error instanceof RestrictionNotFoundError) return jsonError("Not found", 404)
    console.error("PATCH /api/admin/chat-moderation/restrictions/[id]:", error)
    return jsonError("Failed to lift restriction", 500)
  }
}
