import { connection } from "next/server"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { ComingSoonView } from "@/features/reviews/components/ComingSoonView"

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
