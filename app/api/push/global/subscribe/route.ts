import { NextRequest, connection } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { jsonError, jsonUncached } from "@/lib/api";
import {
  subscribeTokenToGlobalTopic,
  unsubscribeTokenFromGlobalTopic,
} from "@/features/notifications/services/topic-subscription";

const bodySchema = z.object({
  token: z.string().trim().min(1, "token is required"),
});

function getIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
}

/** POST — subscribe a web/mobile FCM token to the `global` topic. */
export async function POST(request: NextRequest) {
  await connection();
  try {
    const rl = rateLimit(`push-sub:${getIp(request)}`, 20, 60_000);
    if (!rl.allowed) {
      return Response.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
      );
    }

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

/** DELETE — unsubscribe token from global topic. */
export async function DELETE(request: NextRequest) {
  await connection();
  try {
    const rl = rateLimit(`push-unsub:${getIp(request)}`, 20, 60_000);
    if (!rl.allowed) {
      return Response.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
      );
    }

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
