import Link from "next/link";
import { connection } from "next/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getArticlesPaginatedFromDb } from "@/features/articles/db/articles";
import { ArticlesTable } from "@/features/articles/components";
import { ChevronLeft, Plus, FileText } from "lucide-react";

const ARTICLES_PAGE_SIZE = 20;

type Props = {
  searchParams: Promise<{ page?: string }>;
};

export default async function AdminArticlesPage({ searchParams }: Props) {
  await connection();
  const params = await searchParams;
  const rawPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const { items: articles, total } = await getArticlesPaginatedFromDb({
    page: rawPage,
    limit: ARTICLES_PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil(total / ARTICLES_PAGE_SIZE));

  return (
    <div className="container my-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin">
              <ChevronLeft className="size-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <FileText className="size-6" />
              Articles
            </h1>
            <p className="text-muted-foreground text-sm">
              Manage articles (BlockNote editor)
            </p>
          </div>
        </div>
        <Button asChild>
          <Link href="/admin/articles/new">
            <Plus className="mr-2 size-4" />
            New Article
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Articles</CardTitle>
          <CardDescription>
            Create and edit articles with title, author, and BlockNote content.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ArticlesTable
            articles={articles}
            page={rawPage}
            totalPages={totalPages}
            total={total}
          />
        </CardContent>
      </Card>
    </div>
  );
}
