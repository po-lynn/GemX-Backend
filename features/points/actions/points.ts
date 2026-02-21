"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { canAdminManageUsers } from "@/features/users/permissions/users";
import {
  getDefaultRegistrationPoints,
  getEarningPointsRates,
  getPointManagementSettings,
  savePointManagementSettings,
  setDefaultRegistrationPoints,
  setEarningPointsRates,
  setUserPoints,
} from "@/features/points/db/points";
import type { PointManagementSettings } from "@/features/points/db/points";

export async function getDefaultRegistrationPointsAction(): Promise<number> {
  return getDefaultRegistrationPoints();
}

export async function getEarningPointsRatesAction() {
  return getEarningPointsRates();
}

export async function getPointManagementSettingsAction(): Promise<PointManagementSettings> {
  return getPointManagementSettings();
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
  };
  if (settings.currencyConversion.mmk.amount === 0) settings.currencyConversion.mmk.amount = 1;
  if (settings.currencyConversion.usd.amount === 0) settings.currencyConversion.usd.amount = 1;
  if (settings.currencyConversion.krw.amount === 0) settings.currencyConversion.krw.amount = 1;
  await savePointManagementSettings(settings);
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
