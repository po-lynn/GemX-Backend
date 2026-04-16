import { z } from "zod";

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
