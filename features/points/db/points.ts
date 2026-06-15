import { db } from "@/drizzle/db";
import { user } from "@/drizzle/schema/auth-schema";
import {
  pointPurchaseRequest,
  pointSetting,
  pointTransaction,
  premiumDealersPackage,
} from "@/drizzle/schema/points-schema";
import { sellerRating } from "@/drizzle/schema/seller-rating-schema";
import { and, count, desc, eq, gt, gte, inArray, lte, or, sql } from "drizzle-orm";

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
const POINT_PURCHASE_PACKAGES_JSON_KEY = "point_purchase_packages_json";
const PAYMENT_METHODS_JSON_KEY = "payment_methods_json";
/** @deprecated use PAYMENT_METHODS_JSON_KEY */
const LEGACY_KBZ_PAY_PHONE_KEY = "kbz_pay_phone";

export type PremiumDealerPackage = {
  name: string;
  pointsRequired: number;
  /** How many days the premium dealer status stays active after activation */
  durationDays: number;
  enabled?: boolean;
};

export type PremiumDealersSettings = {
  packages: PremiumDealerPackage[];
};

/** Credit point package available for purchase. Prices are per-currency and optional. */
export type PointPurchasePackage = {
  name: string;
  points: number;
  bonus?: number;       // extra free points on top of base
  popular?: boolean;    // highlights this tier with a badge in the app
  enabled?: boolean;    // controls visibility in the mobile app
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
  type?: 'kbz' | 'aya' | 'wave' | 'cb' | 'other'; // drives icon color gradient in UI
  enabled?: boolean;     // controls visibility in the mobile app
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
      const enabled = typeof o.enabled === "boolean" ? o.enabled : undefined;
      out.push({ name, pointsRequired, durationDays, ...(enabled !== undefined ? { enabled } : {}) });
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
      const bonus = Math.max(0, Math.floor(Number(o.bonus) || 0));
      const popular = typeof o.popular === "boolean" ? o.popular : undefined;
      const enabled = typeof o.enabled === "boolean" ? o.enabled : undefined;
      out.push({
        name,
        points,
        ...(bonus > 0 ? { bonus } : {}),
        ...(popular ? { popular } : {}),
        ...(enabled !== undefined ? { enabled } : {}),
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
      const BANK_TYPES = ["kbz", "aya", "wave", "cb", "other"] as const;
      const type = BANK_TYPES.includes(o.type as (typeof BANK_TYPES)[number])
        ? (o.type as PaymentMethod["type"])
        : undefined;
      const enabled = typeof o.enabled === "boolean" ? o.enabled : undefined;
      if (!name) continue;
      out.push({
        name, accountName, phoneNumber,
        ...(instructions ? { instructions } : {}),
        ...(type ? { type } : {}),
        ...(enabled !== undefined ? { enabled } : {}),
      });
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
  enabled?: boolean;
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
      const enabled = typeof o.enabled === "boolean" ? o.enabled : undefined;
      out.push({ durationDays, points, ...(badge ? { badge } : {}), ...(enabled !== undefined ? { enabled } : {}) });
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

async function getInt(key: string): Promise<number> {
  const [row] = await db.select({ value: pointSetting.value }).from(pointSetting).where(eq(pointSetting.key, key)).limit(1);
  return row?.value ?? 0;
}

async function getText(key: string): Promise<string> {
  const [row] = await db.select({ valueText: pointSetting.valueText }).from(pointSetting).where(eq(pointSetting.key, key)).limit(1);
  return row?.valueText ?? "";
}

async function getSettingsBatch(keys: string[]): Promise<Map<string, { value: number; valueText: string | null }>> {
  if (keys.length === 0) return new Map();
  const rows = await db
    .select({ key: pointSetting.key, value: pointSetting.value, valueText: pointSetting.valueText })
    .from(pointSetting)
    .where(inArray(pointSetting.key, keys));
  const map = new Map<string, { value: number; valueText: string | null }>();
  for (const row of rows) map.set(row.key, { value: row.value, valueText: row.valueText });
  return map;
}

async function getCurrencyConversion(): Promise<{
  mmk: CurrencyConversion;
  usd: CurrencyConversion;
  krw: CurrencyConversion;
}> {
  const map = await getSettingsBatch([
    EARNING_MMK_AMOUNT, EARNING_MMK_POINTS,
    EARNING_USD_AMOUNT, EARNING_USD_POINTS,
    EARNING_KRW_AMOUNT, EARNING_KRW_POINTS,
  ]);
  const gi = (k: string) => map.get(k)?.value ?? 0;
  return {
    mmk: { amount: gi(EARNING_MMK_AMOUNT) || 1, points: gi(EARNING_MMK_POINTS) },
    usd: { amount: gi(EARNING_USD_AMOUNT) || 1, points: gi(EARNING_USD_POINTS) },
    krw: { amount: gi(EARNING_KRW_AMOUNT) || 1, points: gi(EARNING_KRW_POINTS) },
  };
}

export async function getPointManagementSettings(): Promise<PointManagementSettings> {
  const map = await getSettingsBatch([
    DEFAULT_REGISTRATION_POINTS_KEY, REGISTRATION_BONUS_ENABLED_KEY,
    REGISTRATION_BONUS_DESCRIPTION_KEY,
    EARNING_MMK_AMOUNT, EARNING_MMK_POINTS,
    EARNING_USD_AMOUNT, EARNING_USD_POINTS,
    EARNING_KRW_AMOUNT, EARNING_KRW_POINTS,
    MINIMUM_SPEND_AMOUNT, MINIMUM_SPEND_CURRENCY,
    ROUNDING_METHOD, POINT_EXPIRY_DAYS,
    PAYMENT_METHODS_JSON_KEY,
  ]);
  const gi = (k: string) => map.get(k)?.value ?? 0;
  const gt2 = (k: string) => map.get(k)?.valueText ?? "";
  const currencyMap: ("mmk" | "usd" | "krw")[] = ["mmk", "usd", "krw"];
  return {
    defaultRegistrationPoints: gi(DEFAULT_REGISTRATION_POINTS_KEY),
    registrationBonusEnabled: gi(REGISTRATION_BONUS_ENABLED_KEY) !== 0,
    registrationBonusDescription: gt2(REGISTRATION_BONUS_DESCRIPTION_KEY) || "Welcome bonus",
    currencyConversion: {
      mmk: { amount: gi(EARNING_MMK_AMOUNT) || 1000, points: gi(EARNING_MMK_POINTS) || 1 },
      usd: { amount: gi(EARNING_USD_AMOUNT) || 1, points: gi(EARNING_USD_POINTS) || 10 },
      krw: { amount: gi(EARNING_KRW_AMOUNT) || 1000, points: gi(EARNING_KRW_POINTS) || 8 },
    },
    minimumSpendAmount: gi(MINIMUM_SPEND_AMOUNT) || 500,
    minimumSpendCurrency: currencyMap[gi(MINIMUM_SPEND_CURRENCY)] ?? "mmk",
    roundingMethod: (["down", "up", "nearest"] as const)[gi(ROUNDING_METHOD)] ?? "down",
    pointExpiryDays: gi(POINT_EXPIRY_DAYS) || 365,
    paymentMethods: parsePaymentMethodsJson(gt2(PAYMENT_METHODS_JSON_KEY)),
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
  const map = await getSettingsBatch([FEATURED_PRODUCT_HOME_LIMIT_KEY, FEATURE_PRICING_TIERS_JSON_KEY]);
  const limitRow = map.get(FEATURED_PRODUCT_HOME_LIMIT_KEY);
  const tiersRow = map.get(FEATURE_PRICING_TIERS_JSON_KEY);
  const rawLimit = limitRow?.value;
  const homeFeaturedLimit =
    rawLimit != null && rawLimit > 0 ? Math.min(100, Math.max(1, rawLimit)) : 5;
  const pricingTiers = parseFeatureTiersJson(tiersRow?.valueText ?? "");
  return { homeFeaturedLimit, pricingTiers };
}

export async function saveFeatureSettings(s: FeatureSettings): Promise<void> {
  const limit = Math.min(100, Math.max(1, Math.floor(s.homeFeaturedLimit) || 5));
  const tiers = (s.pricingTiers.length > 0 ? s.pricingTiers : DEFAULT_FEATURE_TIERS).map((t) => ({
    durationDays: Math.min(365, Math.max(1, Math.floor(t.durationDays) || 1)),
    points: Math.max(0, Math.floor(t.points) || 0),
    ...(t.badge?.trim() ? { badge: t.badge.trim().slice(0, 50) } : {}),
    ...(typeof t.enabled === "boolean" ? { enabled: t.enabled } : {}),
  }));
  await upsertInt(FEATURED_PRODUCT_HOME_LIMIT_KEY, limit);
  await upsertText(FEATURE_PRICING_TIERS_JSON_KEY, JSON.stringify(tiers));
}

export async function getPremiumDealersSettings(): Promise<PremiumDealersSettings> {
  const map = await getSettingsBatch([PREMIUM_DEALERS_PACKAGES_JSON_KEY]);
  const raw = map.get(PREMIUM_DEALERS_PACKAGES_JSON_KEY)?.valueText ?? "";
  return { packages: parsePremiumDealerPackagesJson(raw) };
}

export async function savePremiumDealersSettings(s: PremiumDealersSettings): Promise<void> {
  const packages = (s.packages.length > 0 ? s.packages : DEFAULT_PREMIUM_DEALER_PACKAGES).map((p) => ({
    name: p.name?.trim() ? p.name.trim().slice(0, 120) : "Package",
    pointsRequired: Math.max(0, Math.floor(p.pointsRequired) || 0),
    durationDays: Math.min(3650, Math.max(1, Math.floor(Number(p.durationDays) || 30))),
    ...(typeof p.enabled === "boolean" ? { enabled: p.enabled } : {}),
  }));
  await upsertText(PREMIUM_DEALERS_PACKAGES_JSON_KEY, JSON.stringify(packages));
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
  const packages = s.packages.map((p) => {
    const bonus = Math.max(0, Math.floor(Number(p.bonus) || 0));
    return {
      name: p.name?.trim() ? p.name.trim().slice(0, 200) : "Package",
      points: Math.max(1, Math.floor(Number(p.points) || 1)),
      ...(bonus > 0 ? { bonus } : {}),
      ...(typeof p.popular === "boolean" ? { popular: p.popular } : {}),
      ...(typeof p.enabled === "boolean" ? { enabled: p.enabled } : {}),
      ...(p.priceMmk != null ? { priceMmk: Math.max(0, Math.floor(Number(p.priceMmk))) } : {}),
      ...(p.priceUsd != null ? { priceUsd: Math.max(0, Math.floor(Number(p.priceUsd))) } : {}),
      ...(p.priceKrw != null ? { priceKrw: Math.max(0, Math.floor(Number(p.priceKrw))) } : {}),
      ...(p.description?.trim() ? { description: p.description.trim().slice(0, 500) } : {}),
    };
  });
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
  pkg: PremiumDealerPackage,
  autoRenew: boolean
): Promise<
  | {
      remainingPoints: number;
      startDate: Date;
      expiresAt: Date;
      autoRenew: boolean;
      status: "active";
    }
  | null
> {
  const cost = Math.max(0, Math.floor(pkg.pointsRequired));
  const startDate = new Date();
  const expiresAt = new Date(startDate.getTime() + pkg.durationDays * 24 * 60 * 60 * 1000);
  const subscriptionId = crypto.randomUUID();

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

    await tx.insert(premiumDealersPackage).values({
      id: subscriptionId,
      userId,
      packageName: pkg.name,
      startDate,
      endDate: expiresAt,
      autoRenew,
      status: "active",
    });

    await tx.insert(pointTransaction).values({
      userId,
      type: "premium_activation",
      direction: "debit",
      amount: cost,
      status: "completed",
      referenceId: subscriptionId,
      referenceType: "premium_package",
      description: `Premium · ${pkg.name}`,
    });

    return {
      remainingPoints: updatedUser.points,
      startDate,
      expiresAt,
      autoRenew,
      status: "active" as const,
    };
  });

  return result;
}

/**
 * Full premium status for the "Become Premium" mobile screen.
 * Returns the user's point balance, active status, expiry, days remaining, and autoRenew in two queries.
 */
export async function getMyPremiumStatus(userId: string): Promise<{
  points: number
  active: boolean
  packageName?: string
  expiresAt?: string
  daysRemaining?: number
  autoRenew?: boolean
}> {
  const [userRow] = await db
    .select({
      points: user.points,
      premiumDealerPackageName: user.premiumDealerPackageName,
      premiumDealerExpiresAt: user.premiumDealerExpiresAt,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

  if (!userRow) return { points: 0, active: false }

  const now = new Date()
  const isActive =
    !!userRow.premiumDealerPackageName &&
    !!userRow.premiumDealerExpiresAt &&
    userRow.premiumDealerExpiresAt > now

  if (!isActive) return { points: userRow.points, active: false }

  const [pkgRow] = await db
    .select({ autoRenew: premiumDealersPackage.autoRenew })
    .from(premiumDealersPackage)
    .where(
      and(
        eq(premiumDealersPackage.userId, userId),
        eq(premiumDealersPackage.status, "active"),
        gt(premiumDealersPackage.endDate, sql`now()`)
      )
    )
    .orderBy(desc(premiumDealersPackage.createdAt))
    .limit(1)

  const daysRemaining = Math.max(
    0,
    Math.ceil((userRow.premiumDealerExpiresAt!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  )

  return {
    points: userRow.points,
    active: true,
    packageName: userRow.premiumDealerPackageName!,
    expiresAt: userRow.premiumDealerExpiresAt!.toISOString(),
    daysRemaining,
    autoRenew: pkgRow?.autoRenew ?? false,
  }
}

/** True when the user has at least one active, non-expired row in `premium_dealers_packages`. */
export async function isUserActivePremiumDealer(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: premiumDealersPackage.id })
    .from(premiumDealersPackage)
    .where(
      and(
        eq(premiumDealersPackage.userId, userId),
        eq(premiumDealersPackage.status, "active"),
        gt(premiumDealersPackage.endDate, sql`now()`)
      )
    )
    .limit(1);
  return row != null;
}

/** Return all users with a currently active (non-expired) premium dealer status. */
export async function getActivePremiumDealers(): Promise<
  {
    userId: string
    name: string
    username: string | null
    image: string | null
    city: string | null
    /** Average seller rating (same rounding as product seller `rating.averageScore`); 0 when none. */
    ratingScore: number
    /** Calendar year of the earliest `premium_dealers_packages.created_at` for this user. */
    firstPremiumDealerYear: number
    /** Earliest `premium_dealers_packages.start_date` for this user (first premium activation). */
    premiumSinceDate: Date
    packageName: string
    startDate: Date
    expiresAt: Date
    autoRenew: boolean
  }[]
> {
  const rows = await db
    .select({
      userId: user.id,
      name: user.name,
      username: user.username,
      image: user.image,
      city: user.city,
      ratingScore: sql<number>`(
        select coalesce(round(avg(${sellerRating.score})::numeric, 2), 0)::double precision
        from ${sellerRating}
        where ${sellerRating.sellerUserId} = ${user.id}
      )`.as("rating_score"),
      firstPremiumDealerYear: sql<number>`(
        select extract(year from min(${premiumDealersPackage.createdAt}))::int
        from ${premiumDealersPackage}
        where ${premiumDealersPackage.userId} = ${user.id}
      )`.as("first_premium_dealer_year"),
      premiumSinceDate: sql<Date>`(
        select min(${premiumDealersPackage.startDate})
        from ${premiumDealersPackage}
        where ${premiumDealersPackage.userId} = ${user.id}
      )`.as("premium_since_date"),
      packageName: premiumDealersPackage.packageName,
      startDate: premiumDealersPackage.startDate,
      expiresAt: premiumDealersPackage.endDate,
      autoRenew: premiumDealersPackage.autoRenew,
    })
    .from(premiumDealersPackage)
    .innerJoin(user, eq(premiumDealersPackage.userId, user.id))
    .where(
      and(
        eq(premiumDealersPackage.status, "active"),
        gt(premiumDealersPackage.endDate, sql`now()`)
      )
    );

  return rows.map((r) => ({
    userId: r.userId,
    name: r.name,
    username: r.username,
    image: r.image,
    city: r.city,
    ratingScore: Number(r.ratingScore ?? 0),
    firstPremiumDealerYear: Number(r.firstPremiumDealerYear),
    // SQL subquery min(timestamp) may return a string from the driver, not a Date.
    premiumSinceDate: new Date(r.premiumSinceDate as Date | string),
    packageName: r.packageName,
    startDate: r.startDate,
    expiresAt: r.expiresAt,
    autoRenew: r.autoRenew,
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

/** Add points to user balance and return latest balance. Also increments pointsLifetime. */
export async function creditUserPoints(
  userId: string,
  pointsToAdd: number
): Promise<{ success: boolean; updatedPoints: number | null }> {
  const safe = Math.max(0, Math.floor(Number(pointsToAdd)) || 0);
  const [updated] = await db
    .update(user)
    .set({
      points: sql`${user.points} + ${safe}`,
      pointsLifetime: sql`${user.pointsLifetime} + ${safe}`,
    })
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

async function getUserByEmail(email: string): Promise<{ id: string } | null> {
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
  const defaultPoints = await getInt(DEFAULT_REGISTRATION_POINTS_KEY);
  const enabledRow = await getInt(REGISTRATION_BONUS_ENABLED_KEY);
  if (enabledRow === 0 || defaultPoints <= 0) return;
  const u = await getUserByEmail(email);
  if (!u) return;
  await setUserPoints(u.id, defaultPoints);
  await logPointTransaction({
    userId: u.id,
    type: "registration_bonus",
    direction: "credit",
    amount: defaultPoints,
    status: "completed",
    referenceType: "registration",
    description: "Registration bonus",
  });
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
  await logPointTransaction({
    userId,
    type: "registration_bonus",
    direction: "credit",
    amount: pointsAdded,
    status: "completed",
    referenceType: "registration",
    description: "Registration bonus",
  })
  return { pointsAdded }
}

export type PointPurchaseRequestRow = {
  id: string;
  userId: string;
  userName: string | null;
  userPhone: string | null;
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
    .select({
      id: pointPurchaseRequest.id,
      userId: pointPurchaseRequest.userId,
      points: pointPurchaseRequest.points,
      status: pointPurchaseRequest.status,
      packageName: pointPurchaseRequest.packageName,
      paymentMethod: pointPurchaseRequest.paymentMethod,
    })
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

  // Update the pending transaction row (created when request was submitted) to completed,
  // or insert a new completed row if the request predates the ledger.
  const updated = await db
    .update(pointTransaction)
    .set({ status: "completed" })
    .where(and(eq(pointTransaction.referenceId, requestId), eq(pointTransaction.status, "pending")))
    .returning({ id: pointTransaction.id });
  if (updated.length === 0) {
    await logPointTransaction({
      userId: existing.userId,
      type: "topup",
      direction: "credit",
      amount: existing.points,
      status: "completed",
      referenceId: requestId,
      referenceType: "purchase_request",
      description: existing.paymentMethod ? `Top-up via ${existing.paymentMethod}` : `Top-up · ${existing.packageName}`,
      paymentMethod: existing.paymentMethod ?? null,
    });
  }

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

  await db
    .update(pointTransaction)
    .set({ status: "rejected" })
    .where(and(eq(pointTransaction.referenceId, requestId), eq(pointTransaction.status, "pending")));

  return { success: true };
}

export async function resetPointPurchaseRequestToPending(
  requestId: string
): Promise<{ success: false; reason: "not_found" } | { success: true }> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({
        id: pointPurchaseRequest.id,
        userId: pointPurchaseRequest.userId,
        points: pointPurchaseRequest.points,
        status: pointPurchaseRequest.status,
      })
      .from(pointPurchaseRequest)
      .where(eq(pointPurchaseRequest.id, requestId))
      .limit(1);
    if (!existing) return { success: false, reason: "not_found" as const };

    if (existing.status === "approved") {
      // Reverse the credit — deduct up to what's available (floor at 0)
      await tx
        .update(user)
        .set({ points: sql`GREATEST(0, ${user.points} - ${existing.points})` })
        .where(eq(user.id, existing.userId));
    }

    // Reset linked transaction back to pending
    await tx
      .update(pointTransaction)
      .set({ status: "pending" })
      .where(eq(pointTransaction.referenceId, requestId));

    await tx
      .update(pointPurchaseRequest)
      .set({ status: "pending", adminNote: null, reviewedByAdminId: null, reviewedAt: null })
      .where(eq(pointPurchaseRequest.id, requestId));

    return { success: true as const };
  });
}

export async function overrideApprovePointPurchaseRequest(
  requestId: string,
  adminId: string,
  adminNote?: string | null
): Promise<{ success: false; reason: "not_found" | "already_approved" } | { success: true; pointsAdded: number }> {
  const [existing] = await db
    .select({ id: pointPurchaseRequest.id, userId: pointPurchaseRequest.userId, points: pointPurchaseRequest.points, status: pointPurchaseRequest.status })
    .from(pointPurchaseRequest)
    .where(eq(pointPurchaseRequest.id, requestId))
    .limit(1);
  if (!existing) return { success: false, reason: "not_found" };
  if (existing.status === "approved") return { success: false, reason: "already_approved" };

  await db
    .update(pointPurchaseRequest)
    .set({ status: "approved", adminNote: adminNote ?? null, reviewedByAdminId: adminId, reviewedAt: new Date() })
    .where(eq(pointPurchaseRequest.id, requestId));

  await creditUserPoints(existing.userId, existing.points);
  return { success: true, pointsAdded: existing.points };
}

export async function overrideRejectPointPurchaseRequest(
  requestId: string,
  adminId: string,
  adminNote?: string | null
): Promise<{ success: false; reason: "not_found" | "already_rejected" } | { success: true }> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({
        id: pointPurchaseRequest.id,
        userId: pointPurchaseRequest.userId,
        points: pointPurchaseRequest.points,
        status: pointPurchaseRequest.status,
      })
      .from(pointPurchaseRequest)
      .where(eq(pointPurchaseRequest.id, requestId))
      .limit(1);
    if (!existing) return { success: false, reason: "not_found" as const };
    if (existing.status === "rejected") return { success: false, reason: "already_rejected" as const };

    if (existing.status === "approved") {
      // Reverse the credit — deduct up to what's available (floor at 0)
      await tx
        .update(user)
        .set({ points: sql`GREATEST(0, ${user.points} - ${existing.points})` })
        .where(eq(user.id, existing.userId));
    }

    // Mark linked transaction as rejected
    await tx
      .update(pointTransaction)
      .set({ status: "rejected" })
      .where(eq(pointTransaction.referenceId, requestId));

    await tx
      .update(pointPurchaseRequest)
      .set({ status: "rejected", adminNote: adminNote ?? null, reviewedByAdminId: adminId, reviewedAt: new Date() })
      .where(eq(pointPurchaseRequest.id, requestId));

    return { success: true as const };
  });
}

export type PremiumDealerSubscriptionRow = {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  packageName: string;
  startDate: Date;
  endDate: Date;
  autoRenew: boolean;
  status: string;
  createdAt: Date;
};

export async function getPremiumDealerSubscriptionsPaginated(opts: {
  page: number;
  limit: number;
  status?: "active" | "expired" | "cancelled";
}): Promise<{ subscriptions: PremiumDealerSubscriptionRow[]; total: number }> {
  const offset = (opts.page - 1) * opts.limit;
  const whereClause = opts.status ? eq(premiumDealersPackage.status, opts.status) : undefined;

  const rows = await db
    .select({
      id: premiumDealersPackage.id,
      userId: premiumDealersPackage.userId,
      userName: user.name,
      userEmail: user.email,
      packageName: premiumDealersPackage.packageName,
      startDate: premiumDealersPackage.startDate,
      endDate: premiumDealersPackage.endDate,
      autoRenew: premiumDealersPackage.autoRenew,
      status: premiumDealersPackage.status,
      createdAt: premiumDealersPackage.createdAt,
    })
    .from(premiumDealersPackage)
    .leftJoin(user, eq(premiumDealersPackage.userId, user.id))
    .where(whereClause)
    .orderBy(desc(premiumDealersPackage.createdAt))
    .limit(opts.limit)
    .offset(offset);

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(premiumDealersPackage)
    .where(whereClause);

  return { subscriptions: rows, total: countRows[0]?.count ?? 0 };
}

export async function getPremiumDealerSubscriptionCounts(): Promise<{
  all: number;
  active: number;
  expired: number;
  cancelled: number;
}> {
  const [row] = await db
    .select({
      all: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${premiumDealersPackage.status} = 'active')::int`,
      expired: sql<number>`count(*) filter (where ${premiumDealersPackage.status} = 'expired')::int`,
      cancelled: sql<number>`count(*) filter (where ${premiumDealersPackage.status} = 'cancelled')::int`,
    })
    .from(premiumDealersPackage);
  return row ?? { all: 0, active: 0, expired: 0, cancelled: 0 };
}

/**
 * Manually deactivate an active premium dealer subscription.
 * Sets status to 'cancelled' and clears the user cache fields atomically.
 * Fails if the subscription is not found or is not currently active.
 */
export async function deactivatePremiumDealerSubscription(
  subscriptionId: string
): Promise<{ success: false; reason: "not_found" | "not_active" } | { success: true }> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        id: premiumDealersPackage.id,
        userId: premiumDealersPackage.userId,
        endDate: premiumDealersPackage.endDate,
        status: premiumDealersPackage.status,
      })
      .from(premiumDealersPackage)
      .where(eq(premiumDealersPackage.id, subscriptionId))
      .limit(1);

    if (!row) return { success: false, reason: "not_found" as const };
    if (row.status !== "active") return { success: false, reason: "not_active" as const };

    await tx
      .update(premiumDealersPackage)
      .set({ status: "cancelled" })
      .where(eq(premiumDealersPackage.id, subscriptionId));

    // Clear user cache only when this subscription's endDate still matches
    // (guards against clearing a newer active subscription if somehow out of sync)
    await tx
      .update(user)
      .set({ premiumDealerPackageName: null, premiumDealerExpiresAt: null })
      .where(and(eq(user.id, row.userId), eq(user.premiumDealerExpiresAt, row.endDate)));

    return { success: true as const };
  });
}

/**
 * Update the expiry date of a premium dealer subscription.
 * Also syncs user.premiumDealerExpiresAt when the subscription is currently active.
 */
export async function updatePremiumDealerSubscriptionExpiry(
  subscriptionId: string,
  newEndDate: Date
): Promise<{ success: false; reason: "not_found" } | { success: true }> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        id: premiumDealersPackage.id,
        userId: premiumDealersPackage.userId,
        status: premiumDealersPackage.status,
      })
      .from(premiumDealersPackage)
      .where(eq(premiumDealersPackage.id, subscriptionId))
      .limit(1);

    if (!row) return { success: false, reason: "not_found" as const };

    await tx
      .update(premiumDealersPackage)
      .set({ endDate: newEndDate })
      .where(eq(premiumDealersPackage.id, subscriptionId));

    if (row.status === "active") {
      await tx
        .update(user)
        .set({ premiumDealerExpiresAt: newEndDate })
        .where(eq(user.id, row.userId));
    }

    return { success: true as const };
  });
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

  const rows = await db
    .select({
      id: pointPurchaseRequest.id,
      userId: pointPurchaseRequest.userId,
      userName: user.name,
      userPhone: user.phone,
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
    .offset(offset)

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(pointPurchaseRequest)
    .where(whereClause)

  return { requests: rows, total: countRows[0]?.count ?? 0 };
}

export async function getPointPurchaseRequestCounts(): Promise<{
  all: number;
  pending: number;
  approved: number;
  rejected: number;
}> {
  const [row] = await db
    .select({
      all:      sql<number>`count(*)::int`,
      pending:  sql<number>`count(*) filter (where ${pointPurchaseRequest.status} = 'pending')::int`,
      approved: sql<number>`count(*) filter (where ${pointPurchaseRequest.status} = 'approved')::int`,
      rejected: sql<number>`count(*) filter (where ${pointPurchaseRequest.status} = 'rejected')::int`,
    })
    .from(pointPurchaseRequest);
  return row ?? { all: 0, pending: 0, approved: 0, rejected: 0 };
}

export type AutoRenewalResult = {
  renewed: number;
  expired: number;
  failed: number;
};

/**
 * Process expired premium dealer subscriptions:
 * - auto_renew=true + sufficient points → deduct points, create new subscription, mark old expired
 * - auto_renew=true + insufficient points → mark expired, clear user cache fields, count as failed
 * - auto_renew=false → mark expired, clear user cache fields
 * Returns counts for monitoring/logging.
 */
export async function processAutoRenewals(): Promise<AutoRenewalResult> {
  const expiredRows = await db
    .select({
      id: premiumDealersPackage.id,
      userId: premiumDealersPackage.userId,
      packageName: premiumDealersPackage.packageName,
      endDate: premiumDealersPackage.endDate,
      autoRenew: premiumDealersPackage.autoRenew,
    })
    .from(premiumDealersPackage)
    .where(
      and(
        eq(premiumDealersPackage.status, "active"),
        lte(premiumDealersPackage.endDate, sql`now()`)
      )
    );

  if (expiredRows.length === 0) return { renewed: 0, expired: 0, failed: 0 };

  const settings = await getPremiumDealersSettings();
  const packagesByName = new Map(settings.packages.map((p) => [p.name, p]));

  let renewed = 0;
  let expired = 0;
  let failed = 0;

  for (const row of expiredRows) {
    const pkg = row.autoRenew ? packagesByName.get(row.packageName) : undefined;

    if (pkg) {
      const cost = Math.max(0, Math.floor(pkg.pointsRequired));
      const newStart = new Date();
      const newExpiry = new Date(newStart.getTime() + pkg.durationDays * 24 * 60 * 60 * 1000);

      const renewedSubId = crypto.randomUUID();
      const didRenew = await db.transaction(async (tx) => {
        // Mark old subscription expired
        await tx
          .update(premiumDealersPackage)
          .set({ status: "expired" })
          .where(eq(premiumDealersPackage.id, row.id));

        // Attempt point deduction
        const [updatedUser] = await tx
          .update(user)
          .set({ points: sql`${user.points} - ${cost}` })
          .where(and(eq(user.id, row.userId), gte(user.points, cost)))
          .returning({ points: user.points });

        if (!updatedUser) {
          // Insufficient points — clear user cache and do not renew
          await tx
            .update(user)
            .set({ premiumDealerPackageName: null, premiumDealerExpiresAt: null })
            .where(
              and(eq(user.id, row.userId), eq(user.premiumDealerExpiresAt, row.endDate))
            );
          return false;
        }

        // Insert new subscription
        await tx.insert(premiumDealersPackage).values({
          id: renewedSubId,
          userId: row.userId,
          packageName: pkg.name,
          startDate: newStart,
          endDate: newExpiry,
          autoRenew: true,
          status: "active",
        });

        await tx.insert(pointTransaction).values({
          userId: row.userId,
          type: "premium_activation",
          direction: "debit",
          amount: cost,
          status: "completed",
          referenceId: renewedSubId,
          referenceType: "premium_package",
          description: `Premium renewal · ${pkg.name}`,
        });

        // Update user cache fields
        await tx
          .update(user)
          .set({ premiumDealerPackageName: pkg.name, premiumDealerExpiresAt: newExpiry })
          .where(eq(user.id, row.userId));

        return true;
      });

      if (didRenew) {
        renewed++;
      } else {
        failed++;
      }
    } else {
      // No auto-renew or package no longer configured — just expire
      await db.transaction(async (tx) => {
        await tx
          .update(premiumDealersPackage)
          .set({ status: "expired" })
          .where(eq(premiumDealersPackage.id, row.id));

        await tx
          .update(user)
          .set({ premiumDealerPackageName: null, premiumDealerExpiresAt: null })
          .where(
            and(eq(user.id, row.userId), eq(user.premiumDealerExpiresAt, row.endDate))
          );
      });
      expired++;
    }
  }

  return { renewed, expired, failed };
}

// ─── Point Transaction Ledger ─────────────────────────────────────────────────

export type PointTransactionRow = {
  id: string;
  userId: string;
  type: string;
  direction: string;
  amount: number;
  status: string;
  referenceId: string | null;
  referenceType: string | null;
  description: string | null;
  paymentMethod: string | null;
  createdBy: string | null;
  createdAt: Date;
};

type LogPointTransactionInput = {
  userId: string;
  type: string;
  direction: "credit" | "debit";
  amount: number;
  status: string;
  referenceId?: string | null;
  referenceType?: string | null;
  description?: string | null;
  paymentMethod?: string | null;
  createdBy?: string | null;
};

export async function logPointTransaction(
  input: LogPointTransactionInput
): Promise<{ id: string }> {
  const [row] = await db
    .insert(pointTransaction)
    .values(input)
    .returning({ id: pointTransaction.id });
  return row;
}

export async function getUserPointBalance(
  userId: string
): Promise<{ available: number; reserved: number; lifetime: number }> {
  const [row] = await db
    .select({ points: user.points, pointsLifetime: user.pointsLifetime, pointsReserved: user.pointsReserved })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (!row) return { available: 0, reserved: 0, lifetime: 0 };
  return { available: row.points, reserved: row.pointsReserved, lifetime: row.pointsLifetime };
}

// ─── Admin: all-user transaction queries ──────────────────────────────────────

export type PointTransactionAdminRow = PointTransactionRow & {
  userName: string | null
  userEmail: string | null
  userPhone: string | null
  packageName: string | null
  createdByName: string | null
}

export async function getPointTransactionsPaginated(opts: {
  page: number
  limit: number
  filter?: "all" | "topups" | "spent" | "pending"
}): Promise<{ transactions: PointTransactionAdminRow[]; total: number }> {
  const { page, limit, filter = "all" } = opts
  const offset = (page - 1) * limit

  const filterCondition =
    filter === "topups"
      ? and(or(eq(pointTransaction.type, "topup"), eq(pointTransaction.type, "registration_bonus")), eq(pointTransaction.status, "completed"))
      : filter === "spent"
      ? and(eq(pointTransaction.direction, "debit"), eq(pointTransaction.status, "completed"))
      : filter === "pending"
      ? eq(pointTransaction.status, "pending")
      : undefined

  const [rows, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: pointTransaction.id,
        userId: pointTransaction.userId,
        type: pointTransaction.type,
        direction: pointTransaction.direction,
        amount: pointTransaction.amount,
        status: pointTransaction.status,
        referenceId: pointTransaction.referenceId,
        referenceType: pointTransaction.referenceType,
        description: pointTransaction.description,
        paymentMethod: pointTransaction.paymentMethod,
        createdAt: pointTransaction.createdAt,
        userName: user.name,
        userEmail: user.email,
        userPhone: user.phone,
        packageName: sql<string | null>`COALESCE(${pointPurchaseRequest.packageName}, ${premiumDealersPackage.packageName})`,
        createdBy: pointTransaction.createdBy,
        createdByName: sql<string | null>`(SELECT name FROM "user" WHERE id = ${pointTransaction.createdBy})`,
      })
      .from(pointTransaction)
      .leftJoin(user, eq(pointTransaction.userId, user.id))
      .leftJoin(pointPurchaseRequest, eq(pointTransaction.referenceId, pointPurchaseRequest.id))
      .leftJoin(premiumDealersPackage, eq(pointTransaction.referenceId, premiumDealersPackage.id))
      .where(filterCondition)
      .orderBy(desc(pointTransaction.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ value: count() })
      .from(pointTransaction)
      .where(filterCondition),
  ])

  return { transactions: rows, total }
}

export async function getPointTransactionCounts(): Promise<{
  all: number; topups: number; spent: number; pending: number
}> {
  const rows = await db
    .select({ type: pointTransaction.type, direction: pointTransaction.direction, status: pointTransaction.status })
    .from(pointTransaction)

  let all = 0, topups = 0, spent = 0, pending = 0
  for (const r of rows) {
    all++
    if (r.status === "pending") pending++
    else if (r.status === "completed" && (r.type === "topup" || r.type === "registration_bonus")) topups++
    else if (r.status === "completed" && r.direction === "debit") spent++
  }
  return { all, topups, spent, pending }
}

export async function getUserPointTransactionCounts(
  userId: string
): Promise<{ all: number; topups: number; spent: number; pending: number }> {
  const rows = await db
    .select({ type: pointTransaction.type, direction: pointTransaction.direction, status: pointTransaction.status })
    .from(pointTransaction)
    .where(eq(pointTransaction.userId, userId));

  let all = 0, topups = 0, spent = 0, pending = 0;
  for (const r of rows) {
    all++;
    if (r.status === "pending") pending++;
    else if (r.status === "completed" && (r.type === "topup" || r.type === "registration_bonus")) topups++;
    else if (r.status === "completed" && r.direction === "debit") spent++;
  }
  return { all, topups, spent, pending };
}

export async function getUserPointHistory(
  userId: string,
  opts: { filter: "all" | "topups" | "spent" | "pending"; page: number; limit: number }
): Promise<{ transactions: PointTransactionRow[]; total: number }> {
  const { filter, page, limit } = opts;
  const offset = (page - 1) * limit;

  const filterCondition =
    filter === "topups"
      ? and(eq(pointTransaction.userId, userId), or(eq(pointTransaction.type, "topup"), eq(pointTransaction.type, "registration_bonus")), eq(pointTransaction.status, "completed"))
      : filter === "spent"
      ? and(eq(pointTransaction.userId, userId), eq(pointTransaction.direction, "debit"), eq(pointTransaction.status, "completed"))
      : filter === "pending"
      ? and(eq(pointTransaction.userId, userId), eq(pointTransaction.status, "pending"))
      : eq(pointTransaction.userId, userId);

  const [rows, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(pointTransaction)
      .where(filterCondition)
      .orderBy(desc(pointTransaction.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ value: count() })
      .from(pointTransaction)
      .where(filterCondition),
  ]);

  return { transactions: rows, total };
}
