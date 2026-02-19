import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArticleForm } from "@/features/articles/components";
import { getArticleById } from "@/features/articles/db/articles";
import { ChevronLeft } from "lucide-react";

type Props = {
  params: Promise<{ id: string }>;
};

async function AdminArticleEditContent({ params }: Props) {
  const { id } = await params;
  const article = await getArticleById(id);

  if (!article) notFound();

  return (
    <div className="container my-6 space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/articles">
            <ChevronLeft className="size-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Edit Article</h1>
          <p className="text-muted-foreground text-sm">{article.title}</p>
        </div>
      </div>

      <ArticleForm key={article.id} mode="edit" article={article} />
    </div>
  );
}

export default function AdminArticleEditPage(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="container my-6 animate-pulse space-y-4 rounded-lg bg-muted/30 p-6">
          Loading...
        </div>
      }
    >
      <AdminArticleEditContent {...props} />
    </Suspense>
  );
}
