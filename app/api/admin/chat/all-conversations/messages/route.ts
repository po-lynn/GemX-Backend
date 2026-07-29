import { NextRequest, connection } from "next/server";
import { z } from "zod";
import { requireStrictAdmin } from "@/lib/api-guard";
import { jsonError, jsonUncached, parseQuery } from "@/lib/api";
import { getConversationMessagesForAdmin } from "@/features/chat/db/admin-all-conversations";

const querySchema = z.object({
  userA: z.string().trim().min(1),
  userB: z.string().trim().min(1),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

/**
 * GET /api/admin/chat/all-conversations/messages?userA=<id>&userB=<id>&page=1&limit=100
 * Admin-only (role === "admin"): read-only message history between two arbitrary users,
 * for the Chat Dashboard oversight view. Neither user needs to be the caller.
 */
export async function GET(request: NextRequest) {
  await connection();
  const guard = await requireStrictAdmin(request);
  if ("error" in guard) return guard.error;

  try {
    const { userA, userB, page, limit } = parseQuery(new URL(request.url).searchParams, querySchema);
    if (userA === userB) return jsonError("userA and userB must differ", 400);

    const { messages, total } = await getConversationMessagesForAdmin(userA, userB, page, limit);
    return jsonUncached({ success: true, messages, page, limit, total });
  } catch (error) {
    console.error("GET /api/admin/chat/all-conversations/messages:", error);
    return jsonError("Failed to load messages", 500);
  }
}
