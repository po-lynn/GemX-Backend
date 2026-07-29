import { NextRequest, connection } from "next/server";
import { requireStrictAdmin } from "@/lib/api-guard";
import { markAdminChatSeen } from "@/features/chat/db/admin-all-conversations";
import { jsonError, jsonUncached } from "@/lib/api";

/**
 * PATCH /api/admin/chat/seen
 * Marks the oversight feed as seen by this admin as of now — clears the bell badge.
 * Matches the PATCH convention used by /api/chat/read-status.
 */
export async function PATCH(request: NextRequest) {
  await connection();
  const guard = await requireStrictAdmin(request);
  if ("error" in guard) return guard.error;

  try {
    await markAdminChatSeen(guard.session.user.id);
    return jsonUncached({ success: true });
  } catch (error) {
    console.error("PATCH /api/admin/chat/seen:", error);
    return jsonError("Failed to mark oversight feed as seen", 500);
  }
}
