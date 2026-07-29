import { NextRequest, connection } from "next/server";
import { auth } from "@/lib/auth";
import { getUnreadConversationPreviews } from "@/features/chat/db/conversations-list";
import { jsonError, jsonUncached } from "@/lib/api";

/**
 * GET /api/chat/unread/preview
 * Returns the latest unread message per peer, for the nav bar notification dropdown.
 */
export async function GET(request: NextRequest) {
  await connection();
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) return jsonError("Unauthorized", 401);

    const conversations = await getUnreadConversationPreviews(session.user.id);
    return jsonUncached({ success: true, conversations });
  } catch (error) {
    console.error("GET /api/chat/unread/preview:", error);
    return jsonError("Failed to load unread conversations", 500);
  }
}
