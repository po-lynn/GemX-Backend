import { NextRequest, connection } from "next/server";
import { auth } from "@/lib/auth";
import { jsonError, jsonUncached } from "@/lib/api";
import { unblockUser } from "@/features/chat/db/blocks";

/** DELETE /api/chat/blocks/[userId] — lifts a block the caller previously issued. */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  await connection();
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) return jsonError("Unauthorized", 401);

    const { userId } = await context.params;
    const removed = await unblockUser(session.user.id, userId);
    if (!removed) return jsonError("Block not found", 404);

    return jsonUncached({ success: true });
  } catch (error) {
    console.error("DELETE /api/chat/blocks/[userId]:", error);
    return jsonError("Failed to unblock user", 500);
  }
}
