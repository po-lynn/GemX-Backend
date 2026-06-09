import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { OriginForm } from "@/features/origin/components";

export default async function AdminOriginNewPage() {
  await requireFeatureAccess(FEATURE_KEYS.ORIGIN)
  return <OriginForm key="create" mode="create" />;
}
