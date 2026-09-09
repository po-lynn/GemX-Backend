import { connection } from "next/server"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { ComingSoonView } from "@/features/reviews/components/ComingSoonView"

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function AdminReviewsOverviewPage() {
  await connection()
  await requireFeatureAccess(FEATURE_KEYS.REVIEWS)
  return (
    <ComingSoonView
      breadcrumbLabel="Overview"
      title="Overview"
      subhead="Buyer reviews publish immediately. This is where the marketplace rating and seller reputation are monitored."
    />
  )
}
