import { NextRequest, connection } from "next/server"
import { jsonError, jsonUncached } from "@/lib/api"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { requireAdminOrFeature } from "@/lib/api-guard"
import { getLastSessionActivityByUserIds } from "@/features/chat/db/session-presence"

const MAX_IDS = 300

/**
 * GET ?ids=id1,id2,...
 * Admin-only. Returns last session activity (ISO) per requested user id among non-expired sessions.
 */
export async function GET(request: NextRequest) {
  await connection()
  try {
    const gate = await requireAdminOrFeature(request, FEATURE_KEYS.CHAT_DASHBOARD)
    if ("error" in gate) return gate.error

    const raw = request.nextUrl.searchParams.get("ids") ?? ""
    const ids = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, MAX_IDS)

    if (ids.length === 0) {
      return jsonUncached({ success: true, activity: {} as Record<string, string | null> })
    }

    const map = await getLastSessionActivityByUserIds(ids)
    const activity: Record<string, string | null> = {}
    for (const id of ids) {
      const d = map.get(id)
      activity[id] = d ? d.toISOString() : null
    }

    return jsonUncached({ success: true, activity })
  } catch (e) {
    console.error("GET /api/admin/chat/presence:", e)
    return jsonError("Failed to load presence", 500)
  }
}
