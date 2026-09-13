import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { PrecautionTagForm } from "@/features/precaution-tags/components"

export default async function AdminPrecautionTagNewPage() {
  await requireFeatureAccess(FEATURE_KEYS.SETTINGS_PRECAUTION_TAGS)
  return <PrecautionTagForm key="create" mode="create" />
}
