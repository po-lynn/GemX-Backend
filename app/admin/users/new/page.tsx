import { requireFeatureAccess } from "@/lib/admin-guard";
import { FEATURE_KEYS } from "@/features/rbac/feature-keys";
import { UserForm } from "@/features/users/components";
import { FadeUp } from "@/components/admin/motion";

export default async function AdminUsersNewPage() {
  const session = await requireFeatureAccess(FEATURE_KEYS.USERS);
  const isInternal = session.user.role === "internal";
  return <FadeUp><UserForm key="create" mode="create" canAssignAdmin={!isInternal} /></FadeUp>;
}
