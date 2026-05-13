import { NextRequest, connection } from "next/server";
import { auth } from "@/lib/auth";
import { getChatConversationsForUser } from "@/features/chat/db/conversations-list";
import { jsonError, jsonUncached } from "@/lib/api";

/**
 * GET /api/chat/conversations
 * Lists every user who shares a message thread with the current user, with last message
 * preview, timestamp (newest first), unread incoming count per peer, and online flag.
 */
export async function GET(_request: NextRequest) {
  await connection();
  try {
    const session = await auth.api.getSession({ headers: _request.headers });
    if (!session?.user?.id) return jsonError("Unauthorized", 401);

    const conversations = await getChatConversationsForUser(session.user.id);

    return jsonUncached({ success: true, conversations });
  } catch (error) {
    console.error("GET /api/chat/conversations:", error);
    return jsonError("Failed to load conversations", 500);
  }
}
