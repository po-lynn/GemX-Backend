"use server";

import { canAdminManageUsers } from "@/features/users/permissions/users";
import {
  getPointManagementSettings,
  savePremiumDealersSettings,
  saveFeatureSettings,
  savePointManagementSettings,
  savePointPurchasePackagesSettings,
  setDefaultRegistrationPoints,
  setEarningPointsRates,
  creditUserPoints,
  deductUserPoints,
  logPointTransaction,
  approvePointPurchaseRequest,
  rejectPointPurchaseRequest,
  resetPointPurchaseRequestToPending,
  overrideApprovePointPurchaseRequest,
  overrideRejectPointPurchaseRequest,
  deactivatePremiumDealerSubscription,
  updatePremiumDealerSubscriptionExpiry,
} from "@/features/points/db/points";
import type { PointPurchasePackagesSettings } from "@/features/points/db/points";
import { requireActionRole } from "@/lib/action-guard";

/** Legacy form: only default registration points + 3 earning rates (points per 1 unit). */
export async function savePointsSettingsAction(formData: FormData) {
  const session = await requireActionRole(canAdminManageUsers);
  if (!session) {
    return { error: "Unauthorized" };
  }
  const defaultPoints = parseIntForm(formData.get("defaultRegistrationPoints"), 0);
  if (Number.isNaN(defaultPoints) || defaultPoints < 0) {
    return { error: "Default points must be a non-negative number." };
  }
  const mmk = parseIntForm(formData.get("earningPointsRateMmk"), 0);
  const usd = parseIntForm(formData.get("earningPointsRateUsd"), 0);
  const krw = parseIntForm(formData.get("earningPointsRateKrw"), 0);
  await setDefaultRegistrationPoints(defaultPoints);
  await setEarningPointsRates({ mmk, usd, krw });
  return { success: true };
}

function parseIntForm(raw: FormDataEntryValue | null, fallback: number): number {
  const v = typeof raw === "string" ? parseInt(raw, 10) : Number(raw);
  return Number.isNaN(v) || v < 0 ? fallback : Math.floor(v);
}

export async function saveCreditSettingsAction(formData: FormData) {
  const session = await requireActionRole(canAdminManageUsers);
  if (!session) return { error: "Unauthorized" };

  const defaultRegistrationPoints = parseIntForm(formData.get("defaultRegistrationPoints"), 0);

  const paymentMethods = (() => {
    try {
      const raw = formData.get("paymentMethodsJson");
      const parsed = JSON.parse(String(raw ?? "[]")) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((x): x is Record<string, unknown> => x != null && typeof x === "object")
        .map((o) => {
          const BANK_TYPES = ["kbz", "aya", "wave", "cb", "other"] as const;
          const type = BANK_TYPES.includes(o.type as (typeof BANK_TYPES)[number])
            ? (o.type as (typeof BANK_TYPES)[number])
            : undefined;
          return {
            name: String(o.name ?? "").trim().slice(0, 100),
            accountName: String(o.accountName ?? "").trim().slice(0, 200),
            phoneNumber: String(o.phoneNumber ?? "").trim().slice(0, 50),
            ...(typeof o.instructions === "string" && o.instructions.trim()
              ? { instructions: o.instructions.trim().slice(0, 500) }
              : {}),
            ...(type ? { type } : {}),
            ...(typeof o.enabled === "boolean" ? { enabled: o.enabled } : {}),
          };
        })
        .filter((m) => m.name);
    } catch { return []; }
  })();

  // Preserve all other point management settings — only update registration points + payment methods
  const existing = await getPointManagementSettings();
  await savePointManagementSettings({ ...existing, defaultRegistrationPoints, paymentMethods });

  // Save packages
  const raw = formData.get("packagesJson");
  let packages: PointPurchasePackagesSettings["packages"];
  try {
    const parsed = JSON.parse(String(raw ?? "[]")) as unknown;
    if (!Array.isArray(parsed)) return { error: "Invalid packages data." };
    packages = parsed
      .filter((x): x is Record<string, unknown> => x != null && typeof x === "object")
      .map((o) => {
        const optPrice = (v: unknown) => {
          if (v == null || v === "") return undefined;
          const n = Math.floor(Number(v));
          return Number.isFinite(n) && n >= 0 ? n : undefined;
        };
        const bonus = Math.max(0, Math.floor(Number(o.bonus) || 0));
        return {
          name: String(o.name ?? "Package").trim().slice(0, 200) || "Package",
          points: Math.max(1, Math.floor(Number(o.points) || 1)),
          ...(bonus > 0 ? { bonus } : {}),
          ...(typeof o.popular === "boolean" ? { popular: o.popular } : {}),
          ...(typeof o.enabled === "boolean" ? { enabled: o.enabled } : {}),
          ...(optPrice(o.priceMmk) != null ? { priceMmk: optPrice(o.priceMmk) } : {}),
          ...(optPrice(o.priceUsd) != null ? { priceUsd: optPrice(o.priceUsd) } : {}),
          ...(optPrice(o.priceKrw) != null ? { priceKrw: optPrice(o.priceKrw) } : {}),
          ...(typeof o.description === "string" && o.description.trim()
            ? { description: o.description.trim().slice(0, 500) }
            : {}),
        };
      });
  } catch {
    return { error: "Invalid packages JSON." };
  }
  await savePointPurchasePackagesSettings({ packages });

  // Save feature settings if provided
  const rawTiers = formData.get("featureTiersJson");
  const rawLimit = formData.get("homeFeaturedLimit");
  if (rawTiers != null) {
    try {
      const parsed = JSON.parse(String(rawTiers)) as unknown;
      if (Array.isArray(parsed)) {
        const tiers = parsed
          .filter((x): x is Record<string, unknown> => x != null && typeof x === "object")
          .map((o) => ({
            durationDays: Math.min(365, Math.max(1, Math.floor(Number(o.durationDays) || 1))),
            points: Math.max(0, Math.floor(Number(o.points) || 0)),
            ...(typeof o.badge === "string" && o.badge.trim() ? { badge: o.badge.trim().slice(0, 50) } : {}),
            ...(typeof o.enabled === "boolean" ? { enabled: o.enabled } : {}),
          }));
        const limit = rawLimit != null ? Math.min(100, Math.max(1, Math.floor(Number(rawLimit) || 5))) : 5;
        await saveFeatureSettings({ homeFeaturedLimit: limit, pricingTiers: tiers });
      }
    } catch { /* ignore */ }
  }

  // Save premium dealer packages if provided
  const rawDealers = formData.get("dealerPackagesJson");
  if (rawDealers != null) {
    try {
      const parsed = JSON.parse(String(rawDealers)) as unknown;
      if (Array.isArray(parsed)) {
        const dealerPackages = parsed
          .filter((x): x is Record<string, unknown> => x != null && typeof x === "object")
          .map((o) => ({
            name: String(o.name ?? "Package").trim().slice(0, 120) || "Package",
            pointsRequired: Math.max(0, Math.floor(Number(o.pointsRequired) || 0)),
            durationDays: Math.min(3650, Math.max(1, Math.floor(Number(o.durationDays) || 30))),
            ...(typeof o.enabled === "boolean" ? { enabled: o.enabled } : {}),
          }));
        await savePremiumDealersSettings({ packages: dealerPackages });
      }
    } catch { /* ignore */ }
  }

  return { success: true };
}

export async function approvePointPurchaseRequestAction(formData: FormData) {
  const session = await requireActionRole(canAdminManageUsers);
  if (!session) return { error: "Unauthorized" };
  const requestId = String(formData.get("requestId") ?? "").trim();
  const adminNote = String(formData.get("adminNote") ?? "").trim() || null;
  if (!requestId) return { error: "Request ID is required." };

  const result = await approvePointPurchaseRequest(requestId, session.user.id, adminNote);
  if (!result.success) return { error: result.reason === "not_found" ? "Request not found." : "Request is not pending." };
  return { success: true };
}

export async function rejectPointPurchaseRequestAction(formData: FormData) {
  const session = await requireActionRole(canAdminManageUsers);
  if (!session) return { error: "Unauthorized" };
  const requestId = String(formData.get("requestId") ?? "").trim();
  const adminNote = String(formData.get("adminNote") ?? "").trim() || null;
  if (!requestId) return { error: "Request ID is required." };

  const result = await rejectPointPurchaseRequest(requestId, session.user.id, adminNote);
  if (!result.success) return { error: result.reason === "not_found" ? "Request not found." : "Request is not pending." };
  return { success: true };
}

export async function resetPointPurchaseRequestAction(formData: FormData) {
  const session = await requireActionRole(canAdminManageUsers);
  if (!session) return { error: "Unauthorized" };
  const requestId = String(formData.get("requestId") ?? "").trim();
  if (!requestId) return { error: "Request ID is required." };

  const result = await resetPointPurchaseRequestToPending(requestId);
  if (!result.success) return { error: "Request not found." };
  return { success: true };
}

export async function overrideApprovePointPurchaseRequestAction(formData: FormData) {
  const session = await requireActionRole(canAdminManageUsers);
  if (!session) return { error: "Unauthorized" };
  const requestId = String(formData.get("requestId") ?? "").trim();
  const adminNote = String(formData.get("adminNote") ?? "").trim() || null;
  if (!requestId) return { error: "Request ID is required." };

  const result = await overrideApprovePointPurchaseRequest(requestId, session.user.id, adminNote);
  if (!result.success) return { error: result.reason === "not_found" ? "Request not found." : "Request is already approved." };
  return { success: true };
}

export async function overrideRejectPointPurchaseRequestAction(formData: FormData) {
  const session = await requireActionRole(canAdminManageUsers);
  if (!session) return { error: "Unauthorized" };
  const requestId = String(formData.get("requestId") ?? "").trim();
  const adminNote = String(formData.get("adminNote") ?? "").trim() || null;
  if (!requestId) return { error: "Request ID is required." };

  const result = await overrideRejectPointPurchaseRequest(requestId, session.user.id, adminNote);
  if (!result.success) return { error: result.reason === "not_found" ? "Request not found." : "Request is already rejected." };
  return { success: true };
}

export async function deactivatePremiumDealerAction(formData: FormData) {
  const session = await requireActionRole(canAdminManageUsers);
  if (!session) {
    return { error: "Unauthorized" };
  }
  const subscriptionId = String(formData.get("subscriptionId") ?? "").trim();
  if (!subscriptionId) return { error: "Subscription ID is required." };

  const result = await deactivatePremiumDealerSubscription(subscriptionId);
  if (!result.success) {
    return {
      error: result.reason === "not_found"
        ? "Subscription not found."
        : "Subscription is not active.",
    };
  }
  return { success: true };
}

export async function updateSubscriptionExpiryAction(formData: FormData) {
  const session = await requireActionRole(canAdminManageUsers);
  if (!session) {
    return { error: "Unauthorized" };
  }
  const subscriptionId = String(formData.get("subscriptionId") ?? "").trim();
  if (!subscriptionId) return { error: "Subscription ID is required." };

  const rawDate = String(formData.get("newEndDate") ?? "").trim();
  const parsed = rawDate ? new Date(rawDate) : null;
  if (!parsed || isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
    return { error: "A valid future date is required." };
  }

  const result = await updatePremiumDealerSubscriptionExpiry(subscriptionId, parsed);
  if (!result.success) return { error: "Subscription not found." };
  return { success: true };
}

export async function adminCreditUserPointsAction(
  userId: string,
  amount: number,
  note?: string
): Promise<{ success: true; updatedPoints: number } | { error: string }> {
  const session = await requireActionRole(canAdminManageUsers);
  if (!session) {
    return { error: "Unauthorized" };
  }
  const safe = Math.floor(Number(amount));
  if (!userId) return { error: "User ID is required." };
  if (isNaN(safe) || safe <= 0) return { error: "Amount must be a positive number." };

  const credited = await creditUserPoints(userId, safe);
  if (!credited.success) return { error: "User not found." };

  await logPointTransaction({
    userId,
    type: "admin_adjustment",
    direction: "credit",
    amount: safe,
    status: "completed",
    description: note?.trim() ? `Admin credit: ${note.trim()}` : "Admin credit",
    createdBy: session.user.id,
  });

  return { success: true, updatedPoints: credited.updatedPoints ?? 0 };
}

export async function adminDeductUserPointsAction(
  userId: string,
  amount: number,
  note?: string
): Promise<{ success: true; updatedPoints: number } | { error: string }> {
  const session = await requireActionRole(canAdminManageUsers);
  if (!session) {
    return { error: "Unauthorized" };
  }
  const safe = Math.floor(Number(amount));
  if (!userId) return { error: "User ID is required." };
  if (isNaN(safe) || safe <= 0) return { error: "Amount must be a positive number." };

  const deducted = await deductUserPoints(userId, safe);
  if (!deducted.success) return { error: "Insufficient balance or user not found." };

  await logPointTransaction({
    userId,
    type: "admin_adjustment",
    direction: "debit",
    amount: safe,
    status: "completed",
    description: note?.trim() ? `Admin deduction: ${note.trim()}` : "Admin deduction",
    createdBy: session.user.id,
  });

  return { success: true, updatedPoints: deducted.remainingPoints ?? 0 };
}

export async function adminTopUpUserPointsAction(
  userId: string,
  amount: number,
  note?: string
): Promise<{ success: true; updatedPoints: number } | { error: string }> {
  const session = await requireActionRole(canAdminManageUsers);
  if (!session) {
    return { error: "Unauthorized" };
  }
  const safe = Math.floor(Number(amount));
  if (!userId) return { error: "User ID is required." };
  if (isNaN(safe) || safe <= 0) return { error: "Amount must be a positive number." };

  const credited = await creditUserPoints(userId, safe);
  if (!credited.success) return { error: "User not found." };

  await logPointTransaction({
    userId,
    type: "topup",
    direction: "credit",
    amount: safe,
    status: "completed",
    description: note?.trim() ? `Admin top-up: ${note.trim()}` : "Admin top-up",
    createdBy: session.user.id,
  });

  return { success: true, updatedPoints: credited.updatedPoints ?? 0 };
}
