import { db } from "@/drizzle/db";
import { user } from "@/drizzle/schema/auth-schema";
import { pointSetting } from "@/drizzle/schema/points-schema";
import { eq } from "drizzle-orm";

const DEFAULT_REGISTRATION_POINTS_KEY = "default_registration_points";
const EARNING_RATE_MMK = "earning_points_rate_mmk";
const EARNING_RATE_USD = "earning_points_rate_usd";
const EARNING_RATE_KRW = "earning_points_rate_krw";

export type EarningPointsRates = { mmk: number; usd: number; krw: number };

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
 * Earning rates: points granted per 1 unit of each currency (e.g. per 1 MMK, 1 USD, 1 KRW).
 * Use when awarding points for transactions in the matching currency.
 */
export async function getEarningPointsRates(): Promise<EarningPointsRates> {
  const [mmkRow, usdRow, krwRow] = await Promise.all([
    db.select({ value: pointSetting.value }).from(pointSetting).where(eq(pointSetting.key, EARNING_RATE_MMK)).limit(1),
    db.select({ value: pointSetting.value }).from(pointSetting).where(eq(pointSetting.key, EARNING_RATE_USD)).limit(1),
    db.select({ value: pointSetting.value }).from(pointSetting).where(eq(pointSetting.key, EARNING_RATE_KRW)).limit(1),
  ]);
  return {
    mmk: mmkRow[0]?.value ?? 0,
    usd: usdRow[0]?.value ?? 0,
    krw: krwRow[0]?.value ?? 0,
  };
}

/** Get earning rate for a single currency (e.g. "mmk" | "usd" | "krw"). */
export async function getEarningPointsRate(currency: keyof EarningPointsRates): Promise<number> {
  const key = currency === "mmk" ? EARNING_RATE_MMK : currency === "usd" ? EARNING_RATE_USD : EARNING_RATE_KRW;
  const [row] = await db
    .select({ value: pointSetting.value })
    .from(pointSetting)
    .where(eq(pointSetting.key, key))
    .limit(1);
  return row?.value ?? 0;
}

export async function setEarningPointsRates(rates: Partial<EarningPointsRates>): Promise<void> {
  const upsert = async (key: string, value: number) => {
    const safe = Math.max(0, Math.floor(Number(value)) || 0);
    await db
      .insert(pointSetting)
      .values({ key, value: safe })
      .onConflictDoUpdate({ target: pointSetting.key, set: { value: safe } });
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
 */
export async function applyDefaultPointsToNewUser(email: string): Promise<void> {
  const defaultPoints = await getDefaultRegistrationPoints();
  if (defaultPoints <= 0) return;
  const u = await getUserByEmail(email);
  if (u) await setUserPoints(u.id, defaultPoints);
}
