import { NextRequest, connection } from "next/server";
import { requireStrictAdmin } from "@/lib/api-guard";
import {
  getAdminChatLastSeenAt,
  getNewConversationsForAdmin,
} from "@/features/chat/db/admin-all-conversations";
import { jsonError, jsonUncached } from "@/lib/api";

/**
 * GET /api/admin/chat/unread/preview
 * Conversation pairs with new activity since this admin last opened the bell/oversight
 * feed — the system-wide counterpart to /api/chat/unread/preview.
 */
export async function GET(request: NextRequest) {
  await connection();
  const guard = await requireStrictAdmin(request);
  if ("error" in guard) return guard.error;

  try {
    const adminId = guard.session.user.id;
    const since = await getAdminChatLastSeenAt(adminId);
    const conversations = await getNewConversationsForAdmin(adminId, since);
    return jsonUncached({ success: true, conversations });
  } catch (error) {
    console.error("GET /api/admin/chat/unread/preview:", error);
    return jsonError("Failed to load new conversations", 500);
  }
}
