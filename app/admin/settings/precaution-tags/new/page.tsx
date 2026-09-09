import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { PrecautionTagForm } from "@/features/precaution-tags/components"

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function AdminPrecautionTagNewPage() {
  await requireFeatureAccess(FEATURE_KEYS.SETTINGS_PRECAUTION_TAGS)
  return <PrecautionTagForm key="create" mode="create" />
}
