import { NextRequest, connection } from "next/server";
import { auth } from "@/lib/auth";
import { jsonError, jsonUncached } from "@/lib/api";
import { canAdminManageUsers } from "@/features/users/permissions/users";
import {
  getFeatureSettings,
  saveFeatureSettings,
} from "@/features/points/db/points";
import type { FeatureSettings } from "@/features/points/db/points";
import { featureSettingsPutBodySchema } from "@/features/points/schemas/admin-points-api";

async function requireAdmin(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return { error: jsonError("Unauthorized", 401) };
  if (!canAdminManageUsers(session.user.role)) {
    return { error: jsonError("Forbidden", 403) };
  }
  return { session };
}

/**
 * GET — featured product home limit and point pricing tiers for featuring.
 * PUT — replace feature settings (admin only).
 */
export async function GET(request: NextRequest) {
  await connection();
  const gate = await requireAdmin(request);
  if ("error" in gate) return gate.error;
  try {
    const settings = await getFeatureSettings();
    return jsonUncached(settings);
  } catch (e) {
    console.error("GET /api/admin/feature-settings:", e);
    return jsonError("Failed to load settings", 500);
  }
}

export async function PUT(request: NextRequest) {
  await connection();
  const gate = await requireAdmin(request);
  if ("error" in gate) return gate.error;
  try {
    const body = await request.json().catch(() => null);
    const parsed = featureSettingsPutBodySchema.safeParse(body);
    if (!parsed.success) {
      const f = parsed.error.flatten();
      const parts = [...f.formErrors];
      for (const [k, v] of Object.entries(f.fieldErrors)) {
        if (v?.length) parts.push(`${k}: ${v[0]}`);
      }
      return jsonError(parts.join("; ") || "Invalid body", 400);
    }
    const d = parsed.data;
    const settings: FeatureSettings = {
      homeFeaturedLimit: d.homeFeaturedLimit,
      pricingTiers: d.pricingTiers.map((t) => ({
        durationDays: t.durationDays,
        points: t.points,
        ...(t.badge != null && String(t.badge).trim()
          ? { badge: String(t.badge).trim().slice(0, 50) }
          : {}),
      })),
    };
    await saveFeatureSettings(settings);
    return jsonUncached({ success: true, settings: await getFeatureSettings() });
  } catch (e) {
    console.error("PUT /api/admin/feature-settings:", e);
    return jsonError("Failed to save settings", 500);
  }
}
