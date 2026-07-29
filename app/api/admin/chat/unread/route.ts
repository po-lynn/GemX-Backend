import { NextRequest, connection } from "next/server";
import { requireStrictAdmin } from "@/lib/api-guard";
import {
  getAdminChatLastSeenAt,
  getNewMessageCountForAdmin,
} from "@/features/chat/db/admin-all-conversations";
import { jsonError, jsonUncached } from "@/lib/api";

/**
 * GET /api/admin/chat/unread
 * System-wide "new messages since I last checked" count for the oversight bell —
 * distinct from /api/chat/unread, which is the personal-inbox count.
 */
export async function GET(request: NextRequest) {
  await connection();
  const guard = await requireStrictAdmin(request);
  if ("error" in guard) return guard.error;

  try {
    const adminId = guard.session.user.id;
    const since = await getAdminChatLastSeenAt(adminId);
    const total = await getNewMessageCountForAdmin(adminId, since);
    return jsonUncached({ success: true, total });
  } catch (error) {
    console.error("GET /api/admin/chat/unread:", error);
    return jsonError("Failed to load unread count", 500);
  }
}
