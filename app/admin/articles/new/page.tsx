import { requireFeatureAccess } from "@/lib/admin-guard";
import { FEATURE_KEYS } from "@/features/rbac/feature-keys";
import { ArticleForm } from "@/features/articles/components";
import { FadeUp } from "@/components/admin/motion";

export default async function AdminArticlesNewPage() {
  await requireFeatureAccess(FEATURE_KEYS.ARTICLES);
  return (
    <FadeUp>
      <div className="py-2">
        <ArticleForm key="create" mode="create" />
      </div>
    </FadeUp>
  );
}
