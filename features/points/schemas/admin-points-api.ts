import { z } from "zod";

const currencyPairSchema = z.object({
  amount: z.coerce.number().int().min(0),
  points: z.coerce.number().int().min(0),
});

/** Request body for `PUT /api/admin/point-management` */
export const pointManagementPutBodySchema = z.object({
  defaultRegistrationPoints: z.coerce.number().int().min(0),
  registrationBonusEnabled: z.boolean(),
  registrationBonusDescription: z.string().max(500).optional().default("Welcome bonus"),
  currencyConversion: z.object({
    mmk: currencyPairSchema,
    usd: currencyPairSchema,
    krw: currencyPairSchema,
  }),
  minimumSpendAmount: z.coerce.number().int().min(0),
  minimumSpendCurrency: z.enum(["mmk", "usd", "krw"]),
  roundingMethod: z.enum(["down", "up", "nearest"]),
  pointExpiryDays: z.coerce.number().int().min(1).max(36500),
});

export type PointManagementPutBody = z.infer<typeof pointManagementPutBodySchema>;

const featureTierSchema = z.object({
  durationDays: z.coerce.number().int().min(1).max(365),
  points: z.coerce.number().int().min(0),
  badge: z.string().max(50).optional().nullable(),
});

/** Request body for `PUT /api/admin/feature-settings` */
export const featureSettingsPutBodySchema = z.object({
  homeFeaturedLimit: z.coerce.number().int().min(1).max(100),
  pricingTiers: z.array(featureTierSchema).min(1).max(20),
});

export type FeatureSettingsPutBody = z.infer<typeof featureSettingsPutBodySchema>;
