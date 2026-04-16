"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { canAdminManageUsers } from "@/features/users/permissions/users";
import {
  getDefaultRegistrationPoints,
  getEarningPointsRates,
  getPremiumDealersSettings,
  getFeatureSettings,
  getPointManagementSettings,
  savePremiumDealersSettings,
  saveFeatureSettings,
  savePointManagementSettings,
  savePointPurchasePackagesSettings,
  setDefaultRegistrationPoints,
  setEarningPointsRates,
  setUserPoints,
  approvePointPurchaseRequest,
  rejectPointPurchaseRequest,
} from "@/features/points/db/points";
import type {
  PremiumDealersSettings,
  FeatureSettings,
  PointManagementSettings,
  PointPurchasePackagesSettings,
} from "@/features/points/db/points";

export async function getDefaultRegistrationPointsAction(): Promise<number> {
  return getDefaultRegistrationPoints();
}

export async function getEarningPointsRatesAction() {
  return getEarningPointsRates();
}

export async function getPointManagementSettingsAction(): Promise<PointManagementSettings> {
  return getPointManagementSettings();
}

export async function getFeatureSettingsAction(): Promise<FeatureSettings> {
  return getFeatureSettings();
}

export async function getPremiumDealersSettingsAction(): Promise<PremiumDealersSettings> {
  return getPremiumDealersSettings();
}

export async function savePremiumDealersSettingsAction(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !canAdminManageUsers(session.user.role)) {
    return { error: "Unauthorized" };
  }
  const raw = formData.get("packagesJson");
  let packages: PremiumDealersSettings["packages"];
  try {
    const parsed = JSON.parse(String(raw ?? "[]")) as unknown;
    if (!Array.isArray(parsed)) {
      return { error: "Invalid packages data." };
    }
    packages = parsed
      .filter((x): x is Record<string, unknown> => x != null && typeof x === "object")
      .map((o) => ({
        name: String(o.name ?? "Package").trim().slice(0, 120) || "Package",
        pointsRequired: Math.max(0, Math.floor(Number(o.pointsRequired) || 0)),
        durationDays: Math.min(3650, Math.max(1, Math.floor(Number(o.durationDays) || 30))),
      }));
  } catch {
    return { error: "Invalid packages JSON." };
  }
  await savePremiumDealersSettings({ packages });
  return { success: true };
}

export async function saveFeatureSettingsAction(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !canAdminManageUsers(session.user.role)) {
    return { error: "Unauthorized" };
  }
  const rawTiers = formData.get("pricingTiersJson");
  const rawLimit = formData.get("homeFeaturedLimit");
  let pricingTiers: FeatureSettings["pricingTiers"];
  try {
    const parsed = JSON.parse(String(rawTiers ?? "[]")) as unknown;
    if (!Array.isArray(parsed)) {
      return { error: "Invalid pricing tiers." };
    }
    pricingTiers = parsed
      .filter((x): x is Record<string, unknown> => x != null && typeof x === "object")
      .map((o) => ({
        durationDays: Math.min(365, Math.max(1, Math.floor(Number(o.durationDays) || 1))),
        points: Math.max(0, Math.floor(Number(o.points) || 0)),
        badge:
          typeof o.badge === "string" && o.badge.trim()
            ? o.badge.trim().slice(0, 50)
            : undefined,
      }));
  } catch {
    return { error: "Invalid pricing tiers JSON." };
  }
  const homeFeaturedLimit = Math.min(
    100,
    Math.max(1, Math.floor(Number(rawLimit) || 5))
  );
  await saveFeatureSettings({ homeFeaturedLimit, pricingTiers });
  return { success: true };
}

/** Legacy form: only default registration points + 3 earning rates (points per 1 unit). */
export async function savePointsSettingsAction(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !canAdminManageUsers(session.user.role)) {
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

export async function savePointManagementSettingsAction(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !canAdminManageUsers(session.user.role)) {
    return { error: "Unauthorized" };
  }
  const settings: PointManagementSettings = {
    defaultRegistrationPoints: parseIntForm(formData.get("defaultRegistrationPoints"), 100),
    registrationBonusEnabled: formData.get("registrationBonusEnabled") === "on",
    registrationBonusDescription: String(formData.get("registrationBonusDescription") ?? "").trim() || "Welcome bonus",
    currencyConversion: {
      mmk: {
        amount: parseIntForm(formData.get("earningMmkAmount"), 1000),
        points: parseIntForm(formData.get("earningMmkPoints"), 1),
      },
      usd: {
        amount: parseIntForm(formData.get("earningUsdAmount"), 1),
        points: parseIntForm(formData.get("earningUsdPoints"), 10),
      },
      krw: {
        amount: parseIntForm(formData.get("earningKrwAmount"), 1000),
        points: parseIntForm(formData.get("earningKrwPoints"), 8),
      },
    },
    minimumSpendAmount: parseIntForm(formData.get("minimumSpendAmount"), 500),
    minimumSpendCurrency: (formData.get("minimumSpendCurrency") as "mmk" | "usd" | "krw") || "mmk",
    roundingMethod: (formData.get("roundingMethod") as "down" | "up" | "nearest") || "down",
    pointExpiryDays: parseIntForm(formData.get("pointExpiryDays"), 365),
    paymentMethods: (() => {
      try {
        const raw = formData.get("paymentMethodsJson");
        const parsed = JSON.parse(String(raw ?? "[]")) as unknown;
        if (!Array.isArray(parsed)) return [];
        return parsed
          .filter((x): x is Record<string, unknown> => x != null && typeof x === "object")
          .map((o) => ({
            name: String(o.name ?? "").trim().slice(0, 100),
            accountName: String(o.accountName ?? "").trim().slice(0, 200),
            phoneNumber: String(o.phoneNumber ?? "").trim().slice(0, 50),
            ...(typeof o.instructions === "string" && o.instructions.trim()
              ? { instructions: o.instructions.trim().slice(0, 500) }
              : {}),
          }))
          .filter((m) => m.name);
      } catch { return []; }
    })(),
  };
  if (settings.currencyConversion.mmk.amount === 0) settings.currencyConversion.mmk.amount = 1;
  if (settings.currencyConversion.usd.amount === 0) settings.currencyConversion.usd.amount = 1;
  if (settings.currencyConversion.krw.amount === 0) settings.currencyConversion.krw.amount = 1;
  await savePointManagementSettings(settings);
  return { success: true };
}

export async function saveCreditSettingsAction(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !canAdminManageUsers(session.user.role)) return { error: "Unauthorized" };

  const defaultRegistrationPoints = parseIntForm(formData.get("defaultRegistrationPoints"), 0);

  const paymentMethods = (() => {
    try {
      const raw = formData.get("paymentMethodsJson");
      const parsed = JSON.parse(String(raw ?? "[]")) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((x): x is Record<string, unknown> => x != null && typeof x === "object")
        .map((o) => ({
          name: String(o.name ?? "").trim().slice(0, 100),
          accountName: String(o.accountName ?? "").trim().slice(0, 200),
          phoneNumber: String(o.phoneNumber ?? "").trim().slice(0, 50),
          ...(typeof o.instructions === "string" && o.instructions.trim()
            ? { instructions: o.instructions.trim().slice(0, 500) }
            : {}),
        }))
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
        return {
          name: String(o.name ?? "Package").trim().slice(0, 200) || "Package",
          points: Math.max(1, Math.floor(Number(o.points) || 1)),
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
  return { success: true };
}

export async function savePointPurchasePackagesSettingsAction(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !canAdminManageUsers(session.user.role)) {
    return { error: "Unauthorized" };
  }
  const raw = formData.get("packagesJson");
  let settings: PointPurchasePackagesSettings;
  try {
    const parsed = JSON.parse(String(raw ?? "[]")) as unknown;
    if (!Array.isArray(parsed)) return { error: "Invalid packages data." };
    settings = {
      packages: parsed
        .filter((x): x is Record<string, unknown> => x != null && typeof x === "object")
        .map((o) => {
          const optPrice = (v: unknown) => {
            if (v == null || v === "") return undefined;
            const n = Math.floor(Number(v));
            return Number.isFinite(n) && n >= 0 ? n : undefined;
          };
          return {
            name: String(o.name ?? "Package").trim().slice(0, 200) || "Package",
            points: Math.max(1, Math.floor(Number(o.points) || 1)),
            ...(optPrice(o.priceMmk) != null ? { priceMmk: optPrice(o.priceMmk) } : {}),
            ...(optPrice(o.priceUsd) != null ? { priceUsd: optPrice(o.priceUsd) } : {}),
            ...(optPrice(o.priceKrw) != null ? { priceKrw: optPrice(o.priceKrw) } : {}),
            ...(typeof o.description === "string" && o.description.trim()
              ? { description: o.description.trim().slice(0, 500) }
              : {}),
          };
        }),
    };
  } catch {
    return { error: "Invalid packages JSON." };
  }
  await savePointPurchasePackagesSettings(settings);
  return { success: true };
}

export async function approvePointPurchaseRequestAction(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !canAdminManageUsers(session.user.role)) return { error: "Unauthorized" };
  const requestId = String(formData.get("requestId") ?? "").trim();
  const adminNote = String(formData.get("adminNote") ?? "").trim() || null;
  if (!requestId) return { error: "Request ID is required." };

  const result = await approvePointPurchaseRequest(requestId, session.user.id, adminNote);
  if (!result.success) return { error: result.reason === "not_found" ? "Request not found." : "Request is not pending." };
  return { success: true };
}

export async function rejectPointPurchaseRequestAction(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !canAdminManageUsers(session.user.role)) return { error: "Unauthorized" };
  const requestId = String(formData.get("requestId") ?? "").trim();
  const adminNote = String(formData.get("adminNote") ?? "").trim() || null;
  if (!requestId) return { error: "Request ID is required." };

  const result = await rejectPointPurchaseRequest(requestId, session.user.id, adminNote);
  if (!result.success) return { error: result.reason === "not_found" ? "Request not found." : "Request is not pending." };
  return { success: true };
}

export async function setUserPointsAction(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !canAdminManageUsers(session.user.role)) {
    return { error: "Unauthorized" };
  }
  const userId = formData.get("userId");
  const raw = formData.get("points");
  if (typeof userId !== "string" || !userId) {
    return { error: "User ID is required." };
  }
  const value = typeof raw === "string" ? parseInt(raw, 10) : Number(raw);
  if (Number.isNaN(value) || value < 0) {
    return { error: "Points must be a non-negative number." };
  }
  await setUserPoints(userId, value);
  return { success: true, userId };
}
