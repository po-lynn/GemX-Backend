import { ArticleForm } from "@/features/articles/components";

export default function AdminArticlesNewPage() {
  return (
    <div className="space-y-5 py-2">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">New Article</h1>
        <p className="mt-0.5 text-sm text-slate-500">Create an article with the BlockNote editor</p>
      </div>
      <ArticleForm key="create" mode="create" />
    </div>
  );
}
