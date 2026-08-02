import { NextRequest, connection } from "next/server";
import { auth } from "@/lib/auth";
import { getUnreadConversationPreviews } from "@/features/chat/db/conversations-list";
import { jsonError, jsonUncached } from "@/lib/api";
import { withQueryTimeout, QueryTimeoutError } from "@/lib/query-timeout";

/** Vercel backstop: if a query hangs past this, the platform kills the invocation instead of it running to the plan default. */
export const maxDuration = 10;

/** Client-facing ceiling for the preview query; leaves headroom under maxDuration for auth/session lookups. */
const UNREAD_PREVIEW_QUERY_TIMEOUT_MS = 6000;

function jsonTimeout(message: string): Response {
  return Response.json(
    { error: message },
    { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "3" } }
  );
}

/**
 * GET /api/chat/unread/preview
 * Returns the latest unread message per peer, for the nav bar notification dropdown.
 *
 * Treated as primary (fail loud) rather than degrade-with-empty-fallback: this route's only
 * job is the preview list, and the bell's unread *count* badge is sourced from a separate
 * endpoint/context, so a fake `conversations: []` on timeout would render "You're all caught
 * up" while the badge still shows a nonzero count — a misleading, confusing mismatch. A 503
 * surfaces as the dropdown's existing distinct "Failed to load notifications" state instead.
 */
export async function GET(request: NextRequest) {
  await connection();
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) return jsonError("Unauthorized", 401);

    const conversations = await withQueryTimeout(
      getUnreadConversationPreviews(session.user.id),
      UNREAD_PREVIEW_QUERY_TIMEOUT_MS,
      "chat-unread-preview"
    );
    return jsonUncached({ success: true, conversations });
  } catch (error) {
    if (error instanceof QueryTimeoutError) {
      console.error("GET /api/chat/unread/preview: timed out:", error.message);
      return jsonTimeout("Notifications are taking longer than usual to load — please retry");
    }
    console.error("GET /api/chat/unread/preview:", error);
    return jsonError("Failed to load unread conversations", 500);
  }
}
