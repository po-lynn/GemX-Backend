import { db } from "@/drizzle/db";
import { user } from "@/drizzle/schema/auth-schema";
import { pointSetting } from "@/drizzle/schema/points-schema";
import { eq } from "drizzle-orm";

const DEFAULT_REGISTRATION_POINTS_KEY = "default_registration_points";
const REGISTRATION_BONUS_ENABLED_KEY = "registration_bonus_enabled";
const REGISTRATION_BONUS_DESCRIPTION_KEY = "registration_bonus_description";
const EARNING_RATE_MMK = "earning_points_rate_mmk";
const EARNING_RATE_USD = "earning_points_rate_usd";
const EARNING_RATE_KRW = "earning_points_rate_krw";
const EARNING_MMK_AMOUNT = "earning_mmk_amount";
const EARNING_MMK_POINTS = "earning_mmk_points";
const EARNING_USD_AMOUNT = "earning_usd_amount";
const EARNING_USD_POINTS = "earning_usd_points";
const EARNING_KRW_AMOUNT = "earning_krw_amount";
const EARNING_KRW_POINTS = "earning_krw_points";
const MINIMUM_SPEND_AMOUNT = "minimum_spend_amount";
const MINIMUM_SPEND_CURRENCY = "minimum_spend_currency";
const ROUNDING_METHOD = "rounding_method";
const POINT_EXPIRY_DAYS = "point_expiry_days";

export type EarningPointsRates = { mmk: number; usd: number; krw: number };

export type CurrencyConversion = { amount: number; points: number };
export type PointManagementSettings = {
  defaultRegistrationPoints: number;
  registrationBonusEnabled: boolean;
  registrationBonusDescription: string;
  currencyConversion: { mmk: CurrencyConversion; usd: CurrencyConversion; krw: CurrencyConversion };
  minimumSpendAmount: number;
  minimumSpendCurrency: "mmk" | "usd" | "krw";
  roundingMethod: "down" | "up" | "nearest";
  pointExpiryDays: number;
};

export async function getDefaultRegistrationPoints(): Promise<number> {
  const [row] = await db
    .select({ value: pointSetting.value })
    .from(pointSetting)
    .where(eq(pointSetting.key, DEFAULT_REGISTRATION_POINTS_KEY))
    .limit(1);
  return row?.value ?? 0;
}

export async function setDefaultRegistrationPoints(value: number): Promise<void> {
  const safe = Math.max(0, Math.floor(Number(value)) || 0);
  await db
    .insert(pointSetting)
    .values({ key: DEFAULT_REGISTRATION_POINTS_KEY, value: safe })
    .onConflictDoUpdate({
      target: pointSetting.key,
      set: { value: safe },
    });
}

/**
 * Earning rates: points granted per 1 unit (derived from amount/points when set).
 * Use when awarding points for transactions in the matching currency.
 */
export async function getEarningPointsRates(): Promise<EarningPointsRates> {
  const conv = await getCurrencyConversion();
  return {
    mmk: conv.mmk.amount > 0 ? conv.mmk.points / conv.mmk.amount : 0,
    usd: conv.usd.amount > 0 ? conv.usd.points / conv.usd.amount : 0,
    krw: conv.krw.amount > 0 ? conv.krw.points / conv.krw.amount : 0,
  };
}

/** Get earning rate for a single currency (e.g. "mmk" | "usd" | "krw"). */
export async function getEarningPointsRate(currency: keyof EarningPointsRates): Promise<number> {
  const rates = await getEarningPointsRates();
  return rates[currency] ?? 0;
}

async function getInt(key: string): Promise<number> {
  const [row] = await db.select({ value: pointSetting.value }).from(pointSetting).where(eq(pointSetting.key, key)).limit(1);
  return row?.value ?? 0;
}

async function getText(key: string): Promise<string> {
  const [row] = await db.select({ valueText: pointSetting.valueText }).from(pointSetting).where(eq(pointSetting.key, key)).limit(1);
  return row?.valueText ?? "";
}

export async function getCurrencyConversion(): Promise<{
  mmk: CurrencyConversion;
  usd: CurrencyConversion;
  krw: CurrencyConversion;
}> {
  const [mmkA, mmkP, usdA, usdP, krwA, krwP] = await Promise.all([
    getInt(EARNING_MMK_AMOUNT), getInt(EARNING_MMK_POINTS),
    getInt(EARNING_USD_AMOUNT), getInt(EARNING_USD_POINTS),
    getInt(EARNING_KRW_AMOUNT), getInt(EARNING_KRW_POINTS),
  ]);
  return {
    mmk: { amount: mmkA || 1, points: mmkP },
    usd: { amount: usdA || 1, points: usdP },
    krw: { amount: krwA || 1, points: krwP },
  };
}

export async function getPointManagementSettings(): Promise<PointManagementSettings> {
  const [
    defaultPoints, bonusEnabled, bonusDesc,
    mmkA, mmkP, usdA, usdP, krwA, krwP,
    minAmount, minCurrency, rounding, expiry,
  ] = await Promise.all([
    getInt(DEFAULT_REGISTRATION_POINTS_KEY),
    getInt(REGISTRATION_BONUS_ENABLED_KEY),
    getText(REGISTRATION_BONUS_DESCRIPTION_KEY),
    getInt(EARNING_MMK_AMOUNT), getInt(EARNING_MMK_POINTS),
    getInt(EARNING_USD_AMOUNT), getInt(EARNING_USD_POINTS),
    getInt(EARNING_KRW_AMOUNT), getInt(EARNING_KRW_POINTS),
    getInt(MINIMUM_SPEND_AMOUNT), getInt(MINIMUM_SPEND_CURRENCY),
    getInt(ROUNDING_METHOD), getInt(POINT_EXPIRY_DAYS),
  ]);
  const currencyMap: ("mmk" | "usd" | "krw")[] = ["mmk", "usd", "krw"];
  return {
    defaultRegistrationPoints: defaultPoints,
    registrationBonusEnabled: bonusEnabled !== 0,
    registrationBonusDescription: bonusDesc || "Welcome bonus",
    currencyConversion: {
      mmk: { amount: mmkA || 1000, points: mmkP || 1 },
      usd: { amount: usdA || 1, points: usdP || 10 },
      krw: { amount: krwA || 1000, points: krwP || 8 },
    },
    minimumSpendAmount: minAmount || 500,
    minimumSpendCurrency: currencyMap[minCurrency] ?? "mmk",
    roundingMethod: (["down", "up", "nearest"] as const)[rounding] ?? "down",
    pointExpiryDays: expiry || 365,
  };
}

const upsertInt = async (key: string, value: number) => {
  const safe = Math.max(0, Math.floor(Number(value)) || 0);
  await db.insert(pointSetting).values({ key, value: safe }).onConflictDoUpdate({ target: pointSetting.key, set: { value: safe } });
};

const upsertText = async (key: string, valueText: string) => {
  await db.insert(pointSetting).values({ key, value: 0, valueText }).onConflictDoUpdate({ target: pointSetting.key, set: { valueText } });
};

export async function savePointManagementSettings(s: PointManagementSettings): Promise<void> {
  await upsertInt(DEFAULT_REGISTRATION_POINTS_KEY, s.defaultRegistrationPoints);
  await upsertInt(REGISTRATION_BONUS_ENABLED_KEY, s.registrationBonusEnabled ? 1 : 0);
  await upsertText(REGISTRATION_BONUS_DESCRIPTION_KEY, s.registrationBonusDescription);
  await upsertInt(EARNING_MMK_AMOUNT, s.currencyConversion.mmk.amount);
  await upsertInt(EARNING_MMK_POINTS, s.currencyConversion.mmk.points);
  await upsertInt(EARNING_USD_AMOUNT, s.currencyConversion.usd.amount);
  await upsertInt(EARNING_USD_POINTS, s.currencyConversion.usd.points);
  await upsertInt(EARNING_KRW_AMOUNT, s.currencyConversion.krw.amount);
  await upsertInt(EARNING_KRW_POINTS, s.currencyConversion.krw.points);
  await upsertInt(MINIMUM_SPEND_AMOUNT, s.minimumSpendAmount);
  await upsertInt(MINIMUM_SPEND_CURRENCY, ["mmk", "usd", "krw"].indexOf(s.minimumSpendCurrency));
  await upsertInt(ROUNDING_METHOD, ["down", "up", "nearest"].indexOf(s.roundingMethod));
  await upsertInt(POINT_EXPIRY_DAYS, s.pointExpiryDays);
  // Keep legacy rate keys for backward compat (points per 1 unit)
  const conv = s.currencyConversion;
  await upsertInt(EARNING_RATE_MMK, conv.mmk.amount > 0 ? Math.floor(conv.mmk.points / conv.mmk.amount) : 0);
  await upsertInt(EARNING_RATE_USD, conv.usd.amount > 0 ? Math.floor(conv.usd.points / conv.usd.amount) : 0);
  await upsertInt(EARNING_RATE_KRW, conv.krw.amount > 0 ? Math.floor(conv.krw.points / conv.krw.amount) : 0);
}

export async function setEarningPointsRates(rates: Partial<EarningPointsRates>): Promise<void> {
  const upsert = async (key: string, value: number) => {
    const safe = Math.max(0, Math.floor(Number(value)) || 0);
    await db.insert(pointSetting).values({ key, value: safe }).onConflictDoUpdate({ target: pointSetting.key, set: { value: safe } });
  };
  if (rates.mmk !== undefined) await upsert(EARNING_RATE_MMK, rates.mmk);
  if (rates.usd !== undefined) await upsert(EARNING_RATE_USD, rates.usd);
  if (rates.krw !== undefined) await upsert(EARNING_RATE_KRW, rates.krw);
}

export async function setUserPoints(userId: string, points: number): Promise<void> {
  const safe = Math.max(0, Math.floor(Number(points)) || 0);
  await db.update(user).set({ points: safe }).where(eq(user.id, userId));
}

export async function getUserByEmail(email: string): Promise<{ id: string } | null> {
  const [row] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);
  return row ?? null;
}

/**
 * Call after a user is created (e.g. after signUpEmail) to grant default registration points.
 * Respects registration bonus enabled setting.
 */
export async function applyDefaultPointsToNewUser(email: string): Promise<void> {
  const [defaultPoints, enabledRow] = await Promise.all([
    getInt(DEFAULT_REGISTRATION_POINTS_KEY),
    getInt(REGISTRATION_BONUS_ENABLED_KEY),
  ]);
  if (enabledRow === 0 || defaultPoints <= 0) return;
  const u = await getUserByEmail(email);
  if (u) await setUserPoints(u.id, defaultPoints);
}
