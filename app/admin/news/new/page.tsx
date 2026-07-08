import { requireFeatureAccess } from "@/lib/admin-guard";
import { FEATURE_KEYS } from "@/features/rbac/feature-keys";
import { NewsForm } from "@/features/news/components";
import { FadeUp } from "@/components/admin/motion";

export default async function AdminNewsNewPage() {
  await requireFeatureAccess(FEATURE_KEYS.NEWS);
  return (
    <FadeUp>
      <div className="py-2">
        <NewsForm key={crypto.randomUUID()} mode="create" />
      </div>
    </FadeUp>
  );
}
