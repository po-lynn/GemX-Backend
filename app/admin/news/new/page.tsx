import { requireFeatureAccess } from "@/lib/admin-guard";
import { FEATURE_KEYS } from "@/features/rbac/feature-keys";
import { NewsForm } from "@/features/news/components";

export default async function AdminNewsNewPage() {
  await requireFeatureAccess(FEATURE_KEYS.NEWS);
  return (
    <div className="py-2">
      <NewsForm key="create" mode="create" />
    </div>
  );
}
