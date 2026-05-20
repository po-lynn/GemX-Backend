import { NextRequest, connection } from "next/server";
import { auth } from "@/lib/auth";
import { jsonError, jsonUncached } from "@/lib/api";
import { canAdminManageUsers } from "@/features/users/permissions/users";
import { adminGlobalPushBodySchema } from "@/features/notifications/schemas/global-push";
import { sendAdminGlobalNotification } from "@/features/notifications/services/global-push";

async function requireAdmin(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return { error: jsonError("Unauthorized", 401) };
  if (!canAdminManageUsers(session.user.role)) {
    return { error: jsonError("Forbidden", 403) };
  }
  return { session };
}

/**
 * POST — send a push notification to all devices on the FCM `global` topic.
 * Mobile app subscribes to this topic on startup (no user login required).
 */
export async function POST(request: NextRequest) {
  await connection();
  const gate = await requireAdmin(request);
  if ("error" in gate) return gate.error;

  try {
    const body = await request.json().catch(() => null);
    const parsed = adminGlobalPushBodySchema.safeParse(body);
    if (!parsed.success) {
      const f = parsed.error.flatten();
      const parts = [...f.formErrors];
      for (const [k, v] of Object.entries(f.fieldErrors)) {
        if (v?.length) parts.push(`${k}: ${v[0]}`);
      }
      return jsonError(parts.join("; ") || "Invalid body", 400);
    }

    const d = parsed.data;
    const result = await sendAdminGlobalNotification({
      title: d.title,
      body: d.body,
      screen: d.screen,
      articleId: d.articleId,
      newsId: d.newsId,
      productId: d.productId,
      link: d.link,
      extraData: d.data,
    });

    if (!result.success) {
      const status = result.error.code === "FCM_NOT_CONFIGURED" ? 503 : 502;
      return jsonUncached(
        { error: result.error.message, code: result.error.code },
        { status }
      );
    }

    return jsonUncached({
      success: true,
      messageId: result.messageId,
      topic: result.topic,
    });
  } catch (e) {
    console.error("POST /api/admin/push/global:", e);
    return jsonError("Failed to send global push notification", 500);
  }
}
