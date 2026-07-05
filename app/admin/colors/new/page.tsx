import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { ColorForm } from "@/features/colors/components";
import { FadeUp } from "@/components/admin/motion";

export default async function AdminColorNewPage() {
  await requireFeatureAccess(FEATURE_KEYS.COLOR)
  return <FadeUp><ColorForm key="create" mode="create" /></FadeUp>;
}
