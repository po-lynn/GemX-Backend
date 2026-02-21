"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { canAdminManageUsers } from "@/features/users/permissions/users";
import {
  getDefaultRegistrationPoints,
  setDefaultRegistrationPoints,
  getEarningPointsRates,
  setEarningPointsRates,
  setUserPoints,
} from "@/features/points/db/points";

export async function getDefaultRegistrationPointsAction(): Promise<number> {
  return getDefaultRegistrationPoints();
}

export async function getEarningPointsRatesAction() {
  return getEarningPointsRates();
}

function parseRate(raw: FormDataEntryValue | null): number {
  const v = typeof raw === "string" ? parseInt(raw, 10) : Number(raw);
  return Number.isNaN(v) || v < 0 ? 0 : Math.floor(v);
}

export async function savePointsSettingsAction(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !canAdminManageUsers(session.user.role)) {
    return { error: "Unauthorized" };
  }
  const defaultRaw = formData.get("defaultRegistrationPoints");
  const defaultValue = typeof defaultRaw === "string" ? parseInt(defaultRaw, 10) : Number(defaultRaw);
  if (Number.isNaN(defaultValue) || defaultValue < 0) {
    return { error: "Default points must be a non-negative number." };
  }
  const mmk = parseRate(formData.get("earningPointsRateMmk"));
  const usd = parseRate(formData.get("earningPointsRateUsd"));
  const krw = parseRate(formData.get("earningPointsRateKrw"));
  await setDefaultRegistrationPoints(defaultValue);
  await setEarningPointsRates({ mmk, usd, krw });
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
