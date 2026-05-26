import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArticleForm } from "@/features/articles/components";
import { getArticleById } from "@/features/articles/db/articles";

type Props = {
  params: Promise<{ id: string }>;
};

async function AdminArticleEditContent({ params }: Props) {
  await connection();
  const { id } = await params;
  const article = await getArticleById(id);
  if (!article) notFound();

  return (
    <div className="py-2">
      <ArticleForm key={article.id} mode="edit" article={article} />
    </div>
  );
}

export default function AdminArticleEditPage(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="animate-pulse space-y-5 py-2">
          <div className="h-8 w-48 rounded-lg bg-slate-200" />
          <div className="h-64 rounded-xl bg-white ring-1 ring-slate-200/60" />
        </div>
      }
    >
      <AdminArticleEditContent {...props} />
    </Suspense>
  );
}
