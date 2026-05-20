import { NextRequest, connection } from "next/server";
import { z } from "zod";
import { jsonError, jsonUncached } from "@/lib/api";
import {
  subscribeTokenToGlobalTopic,
  unsubscribeTokenFromGlobalTopic,
} from "@/features/notifications/services/topic-subscription";

const bodySchema = z.object({
  token: z.string().trim().min(1, "token is required"),
});

/**
 * POST — subscribe a web/mobile FCM token to the `global` topic (no auth).
 * Web clients call this after obtaining a token; Flutter can use client SDK subscribe instead.
 */
export async function POST(request: NextRequest) {
  await connection();
  try {
    const body = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.flatten().formErrors.join("; ") || "Invalid body", 400);
    }

    const result = await subscribeTokenToGlobalTopic(parsed.data.token);
    if (!result.success) {
      const status = result.error.code === "FCM_NOT_CONFIGURED" ? 503 : 502;
      return jsonUncached({ error: result.error.message, code: result.error.code }, { status });
    }

    return jsonUncached({
      success: true,
      topic: result.topic,
      successCount: result.successCount,
      failureCount: result.failureCount,
    });
  } catch (e) {
    console.error("POST /api/push/global/subscribe:", e);
    return jsonError("Failed to subscribe to global topic", 500);
  }
}

/** DELETE — unsubscribe token from global topic (optional, no auth). */
export async function DELETE(request: NextRequest) {
  await connection();
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("token is required", 400);
    }

    const result = await unsubscribeTokenFromGlobalTopic(parsed.data.token);
    if (!result.success) {
      const status = result.error.code === "FCM_NOT_CONFIGURED" ? 503 : 502;
      return jsonUncached({ error: result.error.message, code: result.error.code }, { status });
    }

    return jsonUncached({ success: true, topic: result.topic });
  } catch (e) {
    console.error("DELETE /api/push/global/subscribe:", e);
    return jsonError("Failed to unsubscribe from global topic", 500);
  }
}
