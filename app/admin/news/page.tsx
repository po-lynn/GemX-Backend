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
import { getNewsPaginatedFromDb } from "@/features/news/db/news";
import { NewsTable } from "@/features/news/components";
import { ChevronLeft, Plus, Newspaper } from "lucide-react";

const NEWS_PAGE_SIZE = 20;

type Props = {
  searchParams: Promise<{ page?: string }>;
};

export default async function AdminNewsPage({ searchParams }: Props) {
  await connection();
  const params = await searchParams;
  const rawPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const { items: news, total } = await getNewsPaginatedFromDb({
    page: rawPage,
    limit: NEWS_PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil(total / NEWS_PAGE_SIZE));

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
              <Newspaper className="size-6" />
              News
            </h1>
            <p className="text-muted-foreground text-sm">
              Manage news articles (BlockNote editor)
            </p>
          </div>
        </div>
        <Button asChild>
          <Link href="/admin/news/new">
            <Plus className="mr-2 size-4" />
            New News
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All News</CardTitle>
          <CardDescription>
            Create and edit news with the BlockNote block editor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewsTable
            news={news}
            page={rawPage}
            totalPages={totalPages}
            total={total}
          />
        </CardContent>
      </Card>
    </div>
  );
}
