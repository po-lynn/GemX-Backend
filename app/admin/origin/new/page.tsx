import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { OriginForm } from "@/features/origin/components";
import { FadeUp } from "@/components/admin/motion";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function AdminOriginNewPage() {
  await requireFeatureAccess(FEATURE_KEYS.ORIGIN)
  return <FadeUp><OriginForm key="create" mode="create" /></FadeUp>;
}
