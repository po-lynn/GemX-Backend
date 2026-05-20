import { NextRequest, connection } from "next/server";
import { auth } from "@/lib/auth";
import { jsonError, jsonUncached } from "@/lib/api";
import { registerDeviceBodySchema } from "@/features/notifications/schemas/device";
import { removeUserDevice, upsertUserDevice } from "@/features/notifications/db/user-devices";

export async function POST(request: NextRequest) {
  await connection();
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return jsonError("Unauthorized", 401);

    const body = await request.json();
    const parsed = registerDeviceBodySchema.safeParse(body);
    if (!parsed.success) return jsonError("token is required", 400);

    const { token, platform, deviceId, deviceName, deviceModel, osVersion, appVersion } =
      parsed.data;

    await upsertUserDevice({
      userId: session.user.id,
      fcmToken: token,
      platform: platform ?? null,
      deviceId: deviceId ?? null,
      deviceName: deviceName ?? null,
      deviceModel: deviceModel ?? null,
      osVersion: osVersion ?? null,
      appVersion: appVersion ?? null,
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

    await removeUserDevice(session.user.id, token);
    return jsonUncached({ success: true });
  } catch (err) {
    console.error("DELETE /api/push/register:", err);
    return jsonError("Failed to unregister push token", 500);
  }
}
