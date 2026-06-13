import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { NewLaboratoryFormWrapper } from "./NewLaboratoryFormWrapper";
import { FadeUp } from "@/components/admin/motion"

export default async function AdminLaboratoryNewPage() {
  await requireFeatureAccess(FEATURE_KEYS.LABORATORY)
  return <FadeUp><NewLaboratoryFormWrapper /></FadeUp>;
}
