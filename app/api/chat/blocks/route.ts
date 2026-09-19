import { NextRequest, connection } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/drizzle/db";
import { user } from "@/drizzle/schema/auth-schema";
import { jsonError, jsonUncached } from "@/lib/api";
import { blockUser, listBlockedUsers } from "@/features/chat/db/blocks";

const bodySchema = z.object({
  userId: z.string().trim().min(1),
  reason: z.string().trim().max(500).optional(),
});

/** GET /api/chat/blocks — the current user's own block list. */
export async function GET(request: NextRequest) {
  await connection();
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) return jsonError("Unauthorized", 401);

    const blocked = await listBlockedUsers(session.user.id);
    return jsonUncached({ success: true, blocked });
  } catch (error) {
    console.error("GET /api/chat/blocks:", error);
    return jsonError("Failed to load blocked users", 500);
  }
}

/**
 * POST /api/chat/blocks
 * Blocks a user: they can no longer send the caller messages (checked in both
 * directions by /api/chat/messages), and the conversation drops out of both parties'
 * active list. Idempotent — blocking an already-blocked user is a no-op, not an error.
 */
export async function POST(request: NextRequest) {
  await connection();
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) return jsonError("Unauthorized", 401);

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return jsonError("Invalid input", 400);

    const blockerId = session.user.id;
    const { userId: blockedId, reason } = parsed.data;
    if (blockerId === blockedId) return jsonError("Cannot block yourself", 400);

    const [target] = await db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.id, blockedId), eq(user.archived, false)))
      .limit(1);
    if (!target) return jsonError("User not found", 404);

    await blockUser(blockerId, blockedId, reason);

    return jsonUncached({ success: true });
  } catch (error) {
    console.error("POST /api/chat/blocks:", error);
    return jsonError("Failed to block user", 500);
  }
}
