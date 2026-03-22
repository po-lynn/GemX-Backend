import { NextRequest, connection } from "next/server";
import { auth } from "@/lib/auth";
import { jsonError, jsonUncached } from "@/lib/api";
import { canAdminManageUsers } from "@/features/users/permissions/users";
import {
  getPointManagementSettings,
  savePointManagementSettings,
} from "@/features/points/db/points";
import type { PointManagementSettings } from "@/features/points/db/points";
import {
  pointManagementPutBodySchema,
} from "@/features/points/schemas/admin-points-api";

async function requireAdmin(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return { error: jsonError("Unauthorized", 401) };
  if (!canAdminManageUsers(session.user.role)) {
    return { error: jsonError("Forbidden", 403) };
  }
  return { session };
}

/**
 * GET — full point management settings (registration bonus, earning conversion, minimum spend, rounding, expiry).
 * PUT — replace all settings (admin only).
 */
export async function GET(request: NextRequest) {
  await connection();
  const gate = await requireAdmin(request);
  if ("error" in gate) return gate.error;
  try {
    const settings = await getPointManagementSettings();
    return jsonUncached(settings);
  } catch (e) {
    console.error("GET /api/admin/point-management:", e);
    return jsonError("Failed to load settings", 500);
  }
}

export async function PUT(request: NextRequest) {
  await connection();
  const gate = await requireAdmin(request);
  if ("error" in gate) return gate.error;
  try {
    const body = await request.json().catch(() => null);
    const parsed = pointManagementPutBodySchema.safeParse(body);
    if (!parsed.success) {
      const f = parsed.error.flatten();
      const parts = [...f.formErrors];
      for (const [k, v] of Object.entries(f.fieldErrors)) {
        if (v?.length) parts.push(`${k}: ${v[0]}`);
      }
      return jsonError(parts.join("; ") || "Invalid body", 400);
    }
    const d = parsed.data;
    const settings: PointManagementSettings = {
      defaultRegistrationPoints: d.defaultRegistrationPoints,
      registrationBonusEnabled: d.registrationBonusEnabled,
      registrationBonusDescription: d.registrationBonusDescription.trim() || "Welcome bonus",
      currencyConversion: {
        mmk: {
          amount: d.currencyConversion.mmk.amount || 1,
          points: d.currencyConversion.mmk.points,
        },
        usd: {
          amount: d.currencyConversion.usd.amount || 1,
          points: d.currencyConversion.usd.points,
        },
        krw: {
          amount: d.currencyConversion.krw.amount || 1,
          points: d.currencyConversion.krw.points,
        },
      },
      minimumSpendAmount: d.minimumSpendAmount,
      minimumSpendCurrency: d.minimumSpendCurrency,
      roundingMethod: d.roundingMethod,
      pointExpiryDays: d.pointExpiryDays,
    };
    await savePointManagementSettings(settings);
    return jsonUncached({ success: true, settings: await getPointManagementSettings() });
  } catch (e) {
    console.error("PUT /api/admin/point-management:", e);
    return jsonError("Failed to save settings", 500);
  }
}
