import { db } from "@/drizzle/db";
import { user } from "@/drizzle/schema/auth-schema";
import { pointPurchaseRequest, pointSetting } from "@/drizzle/schema/points-schema";
import { and, desc, eq, gt, gte, isNotNull, isNull, or, sql } from "drizzle-orm";

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
const FEATURED_PRODUCT_HOME_LIMIT_KEY = "featured_product_home_limit";
const FEATURE_PRICING_TIERS_JSON_KEY = "feature_pricing_tiers_json";
const PREMIUM_DEALERS_PACKAGES_JSON_KEY = "premium_dealers_packages_json";
const LEGACY_ESCROW_SERVICE_PACKAGES_JSON_KEY = "escrow_service_packages_json";
const POINT_PURCHASE_PACKAGES_JSON_KEY = "point_purchase_packages_json";
const PAYMENT_METHODS_JSON_KEY = "payment_methods_json";
/** @deprecated use PAYMENT_METHODS_JSON_KEY */
const LEGACY_KBZ_PAY_PHONE_KEY = "kbz_pay_phone";

export type PremiumDealerPackage = {
  name: string;
  pointsRequired: number;
  /** How many days the premium dealer status stays active after activation */
  durationDays: number;
};

export type PremiumDealersSettings = {
  packages: PremiumDealerPackage[];
};

/** Credit point package available for purchase. Prices are per-currency and optional. */
export type PointPurchasePackage = {
  name: string;
  points: number;
  priceMmk?: number | null;
  priceUsd?: number | null;
  priceKrw?: number | null;
  description?: string;
};

export type PointPurchasePackagesSettings = {
  packages: PointPurchasePackage[];
};

/** A payment method customers can use to pay for credit point packages. */
export type PaymentMethod = {
  name: string;          // e.g. "KBZ Pay", "AYA Pay", "Wave Money"
  accountName: string;   // name on the receiving account
  phoneNumber: string;   // account phone number
  instructions?: string; // optional extra info (e.g. reference format)
};

export type PaymentMethodsSettings = {
  methods: PaymentMethod[];
};

const DEFAULT_PREMIUM_DEALER_PACKAGES: PremiumDealerPackage[] = [
  { name: "Basic Package", pointsRequired: 100, durationDays: 30 },
  { name: "Standard Package", pointsRequired: 250, durationDays: 30 },
  { name: "Premium Package", pointsRequired: 500, durationDays: 30 },
];

function parsePremiumDealerPackagesJson(raw: string): PremiumDealerPackage[] {
  if (!raw?.trim()) return DEFAULT_PREMIUM_DEALER_PACKAGES.map((p) => ({ ...p }));
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return DEFAULT_PREMIUM_DEALER_PACKAGES.map((p) => ({ ...p }));
    }
    const out: PremiumDealerPackage[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const name =
        typeof o.name === "string" && o.name.trim()
          ? o.name.trim().slice(0, 120)
          : "Package";
      const pointsRequired = Math.max(0, Math.floor(Number(o.pointsRequired) || 0));
      const durationDays = Math.min(3650, Math.max(1, Math.floor(Number(o.durationDays) || 30)));
      out.push({ name, pointsRequired, durationDays });
    }
    return out.length > 0 ? out : DEFAULT_PREMIUM_DEALER_PACKAGES.map((p) => ({ ...p }));
  } catch {
    return DEFAULT_PREMIUM_DEALER_PACKAGES.map((p) => ({ ...p }));
  }
}

function parseOptionalPrice(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parsePointPurchasePackagesJson(raw: string): PointPurchasePackage[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: PointPurchasePackage[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const name =
        typeof o.name === "string" && o.name.trim()
          ? o.name.trim().slice(0, 200)
          : "Package";
      const points = Math.max(1, Math.floor(Number(o.points) || 1));
      const priceMmk = parseOptionalPrice(o.priceMmk);
      const priceUsd = parseOptionalPrice(o.priceUsd);
      const priceKrw = parseOptionalPrice(o.priceKrw);
      const description =
        typeof o.description === "string" && o.description.trim()
          ? o.description.trim().slice(0, 500)
          : undefined;
      out.push({
        name,
        points,
        ...(priceMmk != null ? { priceMmk } : {}),
        ...(priceUsd != null ? { priceUsd } : {}),
        ...(priceKrw != null ? { priceKrw } : {}),
        ...(description ? { description } : {}),
      });
    }
    return out;
  } catch {
    return [];
  }
}

function parsePaymentMethodsJson(raw: string): PaymentMethod[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: PaymentMethod[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const name = typeof o.name === "string" && o.name.trim() ? o.name.trim().slice(0, 100) : "";
      const accountName = typeof o.accountName === "string" ? o.accountName.trim().slice(0, 200) : "";
      const phoneNumber = typeof o.phoneNumber === "string" ? o.phoneNumber.trim().slice(0, 50) : "";
      const instructions =
        typeof o.instructions === "string" && o.instructions.trim()
          ? o.instructions.trim().slice(0, 500)
          : undefined;
      if (!name) continue;
      out.push({ name, accountName, phoneNumber, ...(instructions ? { instructions } : {}) });
    }
    return out;
  } catch {
    return [];
  }
}

export type FeaturePricingTier = {
  durationDays: number;
  points: number;
  /** e.g. "Best Value" — shown next to points */
  badge?: string;
};

export type FeatureSettings = {
  homeFeaturedLimit: number;
  pricingTiers: FeaturePricingTier[];
};

const DEFAULT_FEATURE_TIERS: FeaturePricingTier[] = [
  { durationDays: 1, points: 100 },
  { durationDays: 3, points: 270 },
  { durationDays: 7, points: 500, badge: "Best Value" },
];

function parseFeatureTiersJson(raw: string): FeaturePricingTier[] {
  if (!raw?.trim()) return DEFAULT_FEATURE_TIERS;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_FEATURE_TIERS;
    const out: FeaturePricingTier[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const durationDays = Math.min(365, Math.max(1, Math.floor(Number(o.durationDays) || 1)));
      const points = Math.max(0, Math.floor(Number(o.points) || 0));
      const badge =
        typeof o.badge === "string" && o.badge.trim() ? o.badge.trim().slice(0, 50) : undefined;
      out.push({ durationDays, points, badge });
    }
    return out.length > 0 ? out : DEFAULT_FEATURE_TIERS;
  } catch {
    return DEFAULT_FEATURE_TIERS;
  }
}

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
  paymentMethods: PaymentMethod[];
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
    paymentMethodsRaw,
  ] = await Promise.all([
    getInt(DEFAULT_REGISTRATION_POINTS_KEY),
    getInt(REGISTRATION_BONUS_ENABLED_KEY),
    getText(REGISTRATION_BONUS_DESCRIPTION_KEY),
    getInt(EARNING_MMK_AMOUNT), getInt(EARNING_MMK_POINTS),
    getInt(EARNING_USD_AMOUNT), getInt(EARNING_USD_POINTS),
    getInt(EARNING_KRW_AMOUNT), getInt(EARNING_KRW_POINTS),
    getInt(MINIMUM_SPEND_AMOUNT), getInt(MINIMUM_SPEND_CURRENCY),
    getInt(ROUNDING_METHOD), getInt(POINT_EXPIRY_DAYS),
    getText(PAYMENT_METHODS_JSON_KEY),
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
    paymentMethods: parsePaymentMethodsJson(paymentMethodsRaw),
  };
}

const upsertInt = async (key: string, value: number) => {
  const safe = Math.max(0, Math.floor(Number(value)) || 0);
  await db.insert(pointSetting).values({ key, value: safe }).onConflictDoUpdate({ target: pointSetting.key, set: { value: safe } });
};

const upsertText = async (key: string, valueText: string) => {
  await db.insert(pointSetting).values({ key, value: 0, valueText }).onConflictDoUpdate({ target: pointSetting.key, set: { valueText } });
};

export async function getFeatureSettings(): Promise<FeatureSettings> {
  const [limitRow, tiersRow] = await Promise.all([
    db
      .select({ value: pointSetting.value })
      .from(pointSetting)
      .where(eq(pointSetting.key, FEATURED_PRODUCT_HOME_LIMIT_KEY))
      .limit(1),
    db
      .select({ valueText: pointSetting.valueText })
      .from(pointSetting)
      .where(eq(pointSetting.key, FEATURE_PRICING_TIERS_JSON_KEY))
      .limit(1),
  ]);
  const rawLimit = limitRow[0]?.value;
  const homeFeaturedLimit =
    rawLimit != null && rawLimit > 0 ? Math.min(100, Math.max(1, rawLimit)) : 5;
  const pricingTiers = parseFeatureTiersJson(tiersRow[0]?.valueText ?? "");
  return { homeFeaturedLimit, pricingTiers };
}

export async function saveFeatureSettings(s: FeatureSettings): Promise<void> {
  const limit = Math.min(100, Math.max(1, Math.floor(s.homeFeaturedLimit) || 5));
  const tiers = (s.pricingTiers.length > 0 ? s.pricingTiers : DEFAULT_FEATURE_TIERS).map((t) => ({
    durationDays: Math.min(365, Math.max(1, Math.floor(t.durationDays) || 1)),
    points: Math.max(0, Math.floor(t.points) || 0),
    ...(t.badge?.trim() ? { badge: t.badge.trim().slice(0, 50) } : {}),
  }));
  await upsertInt(FEATURED_PRODUCT_HOME_LIMIT_KEY, limit);
  await upsertText(FEATURE_PRICING_TIERS_JSON_KEY, JSON.stringify(tiers));
}

export async function getPremiumDealersSettings(): Promise<PremiumDealersSettings> {
  const [newRows, legacyRows] = await Promise.all([
    db
      .select({ valueText: pointSetting.valueText })
      .from(pointSetting)
      .where(eq(pointSetting.key, PREMIUM_DEALERS_PACKAGES_JSON_KEY))
      .limit(1),
    db
      .select({ valueText: pointSetting.valueText })
      .from(pointSetting)
      .where(eq(pointSetting.key, LEGACY_ESCROW_SERVICE_PACKAGES_JSON_KEY))
      .limit(1),
  ]);

  const newRow = newRows[0];
  const legacyRow = legacyRows[0];
  const raw = newRow?.valueText ?? legacyRow?.valueText ?? "";

  // One-time migration path: if only legacy key exists, copy it to new key.
  if (!newRow && legacyRow?.valueText) {
    await upsertText(PREMIUM_DEALERS_PACKAGES_JSON_KEY, legacyRow.valueText);
  }

  return { packages: parsePremiumDealerPackagesJson(raw) };
}

export async function savePremiumDealersSettings(s: PremiumDealersSettings): Promise<void> {
  const packages = (s.packages.length > 0 ? s.packages : DEFAULT_PREMIUM_DEALER_PACKAGES).map((p) => ({
    name: p.name?.trim() ? p.name.trim().slice(0, 120) : "Package",
    pointsRequired: Math.max(0, Math.floor(p.pointsRequired) || 0),
    durationDays: Math.min(3650, Math.max(1, Math.floor(Number(p.durationDays) || 30))),
  }));
  await upsertText(PREMIUM_DEALERS_PACKAGES_JSON_KEY, JSON.stringify(packages));
  await db.delete(pointSetting).where(eq(pointSetting.key, LEGACY_ESCROW_SERVICE_PACKAGES_JSON_KEY));
}

export async function getPointPurchasePackagesSettings(): Promise<PointPurchasePackagesSettings> {
  const [row] = await db
    .select({ valueText: pointSetting.valueText })
    .from(pointSetting)
    .where(eq(pointSetting.key, POINT_PURCHASE_PACKAGES_JSON_KEY))
    .limit(1);
  return { packages: parsePointPurchasePackagesJson(row?.valueText ?? "") };
}

export async function savePointPurchasePackagesSettings(s: PointPurchasePackagesSettings): Promise<void> {
  const packages = s.packages.map((p) => ({
    name: p.name?.trim() ? p.name.trim().slice(0, 200) : "Package",
    points: Math.max(1, Math.floor(Number(p.points) || 1)),
    ...(p.priceMmk != null ? { priceMmk: Math.max(0, Math.floor(Number(p.priceMmk))) } : {}),
    ...(p.priceUsd != null ? { priceUsd: Math.max(0, Math.floor(Number(p.priceUsd))) } : {}),
    ...(p.priceKrw != null ? { priceKrw: Math.max(0, Math.floor(Number(p.priceKrw))) } : {}),
    ...(p.description?.trim() ? { description: p.description.trim().slice(0, 500) } : {}),
  }));
  await upsertText(POINT_PURCHASE_PACKAGES_JSON_KEY, JSON.stringify(packages));
}

/** Get the configured payment methods for credit point purchases. */
export async function getPaymentMethods(): Promise<PaymentMethod[]> {
  const raw = await getText(PAYMENT_METHODS_JSON_KEY);
  // One-time migration: if legacy kbz_pay_phone exists and no payment methods saved yet
  if (!raw?.trim()) {
    const legacyPhone = await getText(LEGACY_KBZ_PAY_PHONE_KEY);
    if (legacyPhone?.trim()) {
      return [{ name: "KBZ Pay", accountName: "", phoneNumber: legacyPhone.trim() }];
    }
    return [];
  }
  return parsePaymentMethodsJson(raw);
}

/**
 * Activate premium dealer status for a user by spending points.
 * Runs atomically: deducts points then sets the premium dealer fields.
 * Returns null if the user has insufficient points.
 */
export async function activatePremiumDealer(
  userId: string,
  pkg: PremiumDealerPackage
): Promise<{ remainingPoints: number; expiresAt: Date } | null> {
  const cost = Math.max(0, Math.floor(pkg.pointsRequired));
  const expiresAt = new Date(Date.now() + pkg.durationDays * 24 * 60 * 60 * 1000);

  const result = await db.transaction(async (tx) => {
    const [updatedUser] = await tx
      .update(user)
      .set({ points: sql`${user.points} - ${cost}` })
      .where(and(eq(user.id, userId), gte(user.points, cost)))
      .returning({ points: user.points });

    if (!updatedUser) return null;

    await tx
      .update(user)
      .set({
        premiumDealerPackageName: pkg.name,
        premiumDealerExpiresAt: expiresAt,
      })
      .where(eq(user.id, userId));

    return { remainingPoints: updatedUser.points, expiresAt };
  });

  return result;
}

/**
 * Get the active premium dealer status for a user.
 * Returns null if the user has no active package or if it has expired.
 */
export async function getUserPremiumDealerStatus(
  userId: string
): Promise<{ packageName: string; expiresAt: Date } | null> {
  const [row] = await db
    .select({
      premiumDealerPackageName: user.premiumDealerPackageName,
      premiumDealerExpiresAt: user.premiumDealerExpiresAt,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!row?.premiumDealerPackageName || !row.premiumDealerExpiresAt) return null;
  if (row.premiumDealerExpiresAt <= new Date()) return null;
  return { packageName: row.premiumDealerPackageName, expiresAt: row.premiumDealerExpiresAt };
}

/** Return all users with a currently active (non-expired) premium dealer status. */
export async function getActivePremiumDealers(): Promise<
  { userId: string; name: string; username: string | null; packageName: string; expiresAt: Date }[]
> {
  const rows = await db
    .select({
      userId: user.id,
      name: user.name,
      username: user.username,
      packageName: user.premiumDealerPackageName,
      expiresAt: user.premiumDealerExpiresAt,
    })
    .from(user)
    .where(
      and(
        isNotNull(user.premiumDealerPackageName),
        isNotNull(user.premiumDealerExpiresAt),
        gt(user.premiumDealerExpiresAt, sql`now()`)
      )
    );

  return rows.map((r) => ({
    userId: r.userId,
    name: r.name,
    username: r.username,
    packageName: r.packageName!,
    expiresAt: r.expiresAt!,
  }));
}

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
  await upsertText(PAYMENT_METHODS_JSON_KEY, JSON.stringify(s.paymentMethods ?? []));
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

/** Add points to user balance and return latest balance. */
export async function creditUserPoints(
  userId: string,
  pointsToAdd: number
): Promise<{ success: boolean; updatedPoints: number | null }> {
  const safe = Math.max(0, Math.floor(Number(pointsToAdd)) || 0);
  const [updated] = await db
    .update(user)
    .set({ points: sql`${user.points} + ${safe}` })
    .where(eq(user.id, userId))
    .returning({ points: user.points });

  if (!updated) return { success: false, updatedPoints: null };
  return { success: true, updatedPoints: updated.points };
}

/** Deduct points only when user has enough balance. Returns remaining points on success. */
export async function deductUserPoints(
  userId: string,
  pointsToDeduct: number
): Promise<{ success: boolean; remainingPoints: number | null }> {
  const safe = Math.max(0, Math.floor(Number(pointsToDeduct)) || 0);
  const [updated] = await db
    .update(user)
    .set({ points: sql`${user.points} - ${safe}` })
    .where(and(eq(user.id, userId), gte(user.points, safe)))
    .returning({ points: user.points });

  if (!updated) return { success: false, remainingPoints: null };
  return { success: true, remainingPoints: updated.points };
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

/**
 * Mobile register: credit the configured default registration points to a user.
 * This does NOT depend on the registration bonus enabled flag — it is always applied when > 0.
 */
export async function creditDefaultRegistrationPointsToUser(
  userId: string
): Promise<{ pointsAdded: number }> {
  const defaultPoints = await getInt(DEFAULT_REGISTRATION_POINTS_KEY)
  const pointsAdded = Math.max(0, Math.floor(Number(defaultPoints)) || 0)
  if (pointsAdded <= 0) return { pointsAdded: 0 }
  await creditUserPoints(userId, pointsAdded)
  return { pointsAdded }
}

export type PointPurchaseRequestRow = {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  packageName: string;
  points: number;
  price: number;
  currency: string;
  status: string;
  transferredAmount: number | null;
  transferredName: string | null;
  transactionReference: string | null;
  transferNote: string | null;
  adminNote: string | null;
  reviewedByAdminId: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
};

export async function approvePointPurchaseRequest(
  requestId: string,
  adminId: string,
  adminNote?: string | null
): Promise<{ success: false; reason: "not_found" | "not_pending" } | { success: true; pointsAdded: number; updatedPoints: number | null }> {
  const [existing] = await db
    .select({ id: pointPurchaseRequest.id, userId: pointPurchaseRequest.userId, points: pointPurchaseRequest.points, status: pointPurchaseRequest.status })
    .from(pointPurchaseRequest)
    .where(eq(pointPurchaseRequest.id, requestId))
    .limit(1);
  if (!existing) return { success: false, reason: "not_found" };
  if (existing.status !== "pending") return { success: false, reason: "not_pending" };

  await db
    .update(pointPurchaseRequest)
    .set({ status: "approved", adminNote: adminNote ?? null, reviewedByAdminId: adminId, reviewedAt: new Date() })
    .where(eq(pointPurchaseRequest.id, requestId));

  const credited = await creditUserPoints(existing.userId, existing.points);
  return { success: true, pointsAdded: existing.points, updatedPoints: credited.updatedPoints };
}

export async function rejectPointPurchaseRequest(
  requestId: string,
  adminId: string,
  adminNote?: string | null
): Promise<{ success: false; reason: "not_found" | "not_pending" } | { success: true }> {
  const [existing] = await db
    .select({ id: pointPurchaseRequest.id, status: pointPurchaseRequest.status })
    .from(pointPurchaseRequest)
    .where(eq(pointPurchaseRequest.id, requestId))
    .limit(1);
  if (!existing) return { success: false, reason: "not_found" };
  if (existing.status !== "pending") return { success: false, reason: "not_pending" };

  await db
    .update(pointPurchaseRequest)
    .set({ status: "rejected", adminNote: adminNote ?? null, reviewedByAdminId: adminId, reviewedAt: new Date() })
    .where(eq(pointPurchaseRequest.id, requestId));

  return { success: true };
}

export async function getPointPurchaseRequestsPaginated(opts: {
  page: number;
  limit: number;
  status?: string;
}): Promise<{ requests: PointPurchaseRequestRow[]; total: number }> {
  const offset = (opts.page - 1) * opts.limit;
  const whereClause =
    opts.status && opts.status !== "all"
      ? eq(pointPurchaseRequest.status, opts.status)
      : undefined;

  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: pointPurchaseRequest.id,
        userId: pointPurchaseRequest.userId,
        userName: user.name,
        userEmail: user.email,
        packageName: pointPurchaseRequest.packageName,
        points: pointPurchaseRequest.points,
        price: pointPurchaseRequest.price,
        currency: pointPurchaseRequest.currency,
        status: pointPurchaseRequest.status,
        transferredAmount: pointPurchaseRequest.transferredAmount,
        transferredName: pointPurchaseRequest.transferredName,
        transactionReference: pointPurchaseRequest.transactionReference,
        transferNote: pointPurchaseRequest.transferNote,
        adminNote: pointPurchaseRequest.adminNote,
        reviewedByAdminId: pointPurchaseRequest.reviewedByAdminId,
        reviewedAt: pointPurchaseRequest.reviewedAt,
        createdAt: pointPurchaseRequest.createdAt,
      })
      .from(pointPurchaseRequest)
      .leftJoin(user, eq(pointPurchaseRequest.userId, user.id))
      .where(whereClause)
      .orderBy(desc(pointPurchaseRequest.createdAt))
      .limit(opts.limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(pointPurchaseRequest)
      .where(whereClause),
  ]);

  return { requests: rows, total: countRows[0]?.count ?? 0 };
}
