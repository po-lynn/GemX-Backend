import { connection } from "next/server"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { ComingSoonView } from "@/features/reviews/components/ComingSoonView"

export default async function AdminReviewsThresholdsPage() {
  await connection()
  await requireFeatureAccess(FEATURE_KEYS.REVIEWS)
  return (
    <ComingSoonView
      breadcrumbLabel="Case thresholds"
      title="Case thresholds"
      subhead="What opens a reputation case, and how the seller rating tags feed those rules."
    />
  )
}
