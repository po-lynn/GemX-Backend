import { NextRequest, connection } from "next/server"
import { auth } from "@/lib/auth"
import { jsonError, jsonUncached } from "@/lib/api"
import { canAdminManageUsers } from "@/features/users/permissions/users"
import { getLastSessionActivityByUserIds } from "@/features/chat/db/session-presence"

const MAX_IDS = 300

/**
 * GET ?ids=id1,id2,...
 * Admin-only. Returns last session activity (ISO) per requested user id among non-expired sessions.
 */
export async function GET(request: NextRequest) {
  await connection()
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user?.id || !canAdminManageUsers(session.user.role)) {
      return jsonError("Unauthorized", 401)
    }

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
