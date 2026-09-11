import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { RatingTagForm } from "@/features/rating-tags/components"

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function AdminRatingTagNewPage() {
  await requireFeatureAccess(FEATURE_KEYS.SETTINGS_RATING_TAGS)
  return <RatingTagForm key="create" mode="create" />
}
