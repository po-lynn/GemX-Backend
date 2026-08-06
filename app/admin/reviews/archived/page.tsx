import { connection } from "next/server"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { ComingSoonView } from "@/features/reviews/components/ComingSoonView"

export default async function AdminReviewsArchivedPage() {
  await connection()
  await requireFeatureAccess(FEATURE_KEYS.REVIEWS)
  return (
    <ComingSoonView
      breadcrumbLabel="Archived sellers"
      title="Archived sellers"
      subhead="Archived and excluded from open cases. Restoring republishes the profile with its rating history intact."
    />
  )
}
