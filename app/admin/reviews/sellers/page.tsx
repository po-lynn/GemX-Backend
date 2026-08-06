import { connection } from "next/server"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { ComingSoonView } from "@/features/reviews/components/ComingSoonView"

export default async function AdminReviewsSellersPage() {
  await connection()
  await requireFeatureAccess(FEATURE_KEYS.REVIEWS)
  return (
    <ComingSoonView
      breadcrumbLabel="Seller ratings"
      title="Seller ratings"
      subhead="Every rated seller with its rating, distribution and review volume."
    />
  )
}
