import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { RatingTagForm } from "@/features/rating-tags/components"

export default async function AdminRatingTagNewPage() {
  await requireFeatureAccess(FEATURE_KEYS.SETTINGS_RATING_TAGS)
  return <RatingTagForm key="create" mode="create" />
}
