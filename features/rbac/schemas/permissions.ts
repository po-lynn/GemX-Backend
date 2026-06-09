import { z } from "zod"
import { FEATURE_KEYS, type FeatureKey } from "../feature-keys"

const featureKeyEnum = z.enum(
  Object.values(FEATURE_KEYS) as [FeatureKey, ...FeatureKey[]]
)

export const updatePermissionsSchema = z.object({
  permissions: z.record(featureKeyEnum, z.boolean()),
})

export type UpdatePermissionsBody = z.infer<typeof updatePermissionsSchema>
