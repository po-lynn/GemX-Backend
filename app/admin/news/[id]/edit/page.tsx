import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Button } from "@/components/ui/button";
import { NewsForm } from "@/features/news/components";
import { getNewsById } from "@/features/news/db/news";
import { ChevronLeft } from "lucide-react";

type Props = {
  params: Promise<{ id: string }>;
};

async function AdminNewsEditContent({ params }: Props) {
  await connection();
  const { id } = await params;
  const news = await getNewsById(id);

  if (!news) notFound();

  return (
    <div className="container my-6 space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/news">
            <ChevronLeft className="size-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Edit News</h1>
          <p className="text-muted-foreground text-sm">{news.title}</p>
        </div>
      </div>

      <NewsForm key={news.id} mode="edit" news={news} />
    </div>
  );
}

export default function AdminNewsEditPage(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="container my-6 animate-pulse space-y-4 rounded-lg bg-muted/30 p-6">
          Loading...
        </div>
      }
    >
      <AdminNewsEditContent {...props} />
    </Suspense>
  );
}
