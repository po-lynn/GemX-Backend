import { NextRequest, connection } from "next/server";
import { auth } from "@/lib/auth";
import { jsonError, jsonUncached } from "@/lib/api";
import { upsertPushToken, removePushToken } from "@/features/push/db/push-tokens";

export async function POST(request: NextRequest) {
  await connection();
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return jsonError("Unauthorized", 401);

    const body = await request.json();
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    if (!token) return jsonError("token is required", 400);

    const platform =
      body?.platform === "android" || body?.platform === "ios" ? body.platform : undefined;

    await upsertPushToken({
      userId: session.user.id,
      token,
      platform,
    });

    return jsonUncached({ success: true });
  } catch (err) {
    console.error("POST /api/push/register:", err);
    return jsonError("Failed to register push token", 500);
  }
}

export async function DELETE(request: NextRequest) {
  await connection();
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return jsonError("Unauthorized", 401);

    const body = await request.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    if (!token) return jsonError("token is required", 400);

    await removePushToken(session.user.id, token);
    return jsonUncached({ success: true });
  } catch (err) {
    console.error("DELETE /api/push/register:", err);
    return jsonError("Failed to unregister push token", 500);
  }
}
