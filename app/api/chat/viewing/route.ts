import { NextRequest, connection } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { jsonError, jsonUncached } from "@/lib/api";
import {
  clearActiveChatView,
  setActiveChatView,
} from "@/features/chat/db/active-chat-view";

const bodySchema = z.object({
  peerId: z.string().trim().min(1),
});

/**
 * PUT — heartbeat: user is viewing 1:1 chat with peerId (suppresses push to this user for that thread).
 * DELETE — user left the chat screen.
 */
export async function PUT(request: NextRequest) {
  await connection();
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) return jsonError("Unauthorized", 401);

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return jsonError("peerId is required", 400);

    if (parsed.data.peerId === session.user.id) {
      return jsonError("Cannot view chat with yourself", 400);
    }

    await setActiveChatView(session.user.id, parsed.data.peerId);
    return jsonUncached({ success: true });
  } catch (e) {
    console.error("PUT /api/chat/viewing:", e);
    return jsonError("Failed to update chat view state", 500);
  }
}

export async function DELETE(request: NextRequest) {
  await connection();
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) return jsonError("Unauthorized", 401);

    await clearActiveChatView(session.user.id);
    return jsonUncached({ success: true });
  } catch (e) {
    console.error("DELETE /api/chat/viewing:", e);
    return jsonError("Failed to clear chat view state", 500);
  }
}
