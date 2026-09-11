import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { NewLaboratoryFormWrapper } from "./NewLaboratoryFormWrapper";
import { FadeUp } from "@/components/admin/motion"

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function AdminLaboratoryNewPage() {
  await requireFeatureAccess(FEATURE_KEYS.LABORATORY)
  return <FadeUp><NewLaboratoryFormWrapper /></FadeUp>;
}
