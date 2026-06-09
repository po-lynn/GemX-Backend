import { requireFeatureAccess } from "@/lib/admin-guard";
import { FEATURE_KEYS } from "@/features/rbac/feature-keys";
import { ArticleForm } from "@/features/articles/components";

export default async function AdminArticlesNewPage() {
  await requireFeatureAccess(FEATURE_KEYS.ARTICLES);
  return (
    <div className="py-2">
      <ArticleForm key="create" mode="create" />
    </div>
  );
}
