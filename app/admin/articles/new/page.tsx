import { ArticleForm } from "@/features/articles/components";

export default function AdminArticlesNewPage() {
  return (
    <div className="py-2">
      <ArticleForm key="create" mode="create" />
    </div>
  );
}
