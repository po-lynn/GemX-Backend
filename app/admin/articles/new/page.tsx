import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArticleForm } from "@/features/articles/components";
import { ChevronLeft } from "lucide-react";

export default function AdminArticlesNewPage() {
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
          <h1 className="text-2xl font-semibold tracking-tight">New Article</h1>
          <p className="text-muted-foreground text-sm">
            Create an article with BlockNote editor
          </p>
        </div>
      </div>

      <ArticleForm key="create" mode="create" />
    </div>
  );
}
