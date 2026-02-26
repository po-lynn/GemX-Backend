"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  createArticleAction,
  updateArticleAction,
} from "@/features/articles/actions/articles";
import type { ArticleRow } from "@/features/articles/db/articles";

const BlockNoteEditor = dynamic(
  () =>
    import("@/features/news/components/BlockNoteEditor").then((m) => m.BlockNoteEditor),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[280px] rounded-md border border-input bg-muted/30 animate-pulse" />
    ),
  }
);

const inputClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

const STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
];

type Props = {
  mode: "create" | "edit";
  article?: ArticleRow | null;
};

export function ArticleForm({ mode, article }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isEdit = mode === "edit";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    try {
      const result = isEdit
        ? await updateArticleAction(formData)
        : await createArticleAction(formData);
      if (result?.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
      await router.push("/admin/articles");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const publishDateDisplay = article?.publishDate
    ? new Date(article.publishDate).toISOString().slice(0, 16)
    : "";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEdit ? "Edit Article" : "New Article"}</CardTitle>
        <CardDescription>
          {isEdit
            ? "Update the article"
            : "Create an article (content with BlockNote editor)"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {isEdit && article && (
            <input type="hidden" name="articleId" value={article.id} />
          )}
          <div className="space-y-2">
            <label htmlFor="title" className="text-sm font-medium">
              Title *
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              maxLength={500}
              defaultValue={article?.title ?? ""}
              placeholder="Article title"
              className={inputClass}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="author" className="text-sm font-medium">
              Author
            </label>
            <input
              id="author"
              name="author"
              type="text"
              maxLength={200}
              defaultValue={article?.author ?? ""}
              placeholder="Author name"
              className={inputClass}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="status" className="text-sm font-medium">
                Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue={article?.status ?? "draft"}
                className={inputClass}
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="publishDate" className="text-sm font-medium">
                Publish date / time
              </label>
              <input
                id="publishDate"
                name="publishDate"
                type="datetime-local"
                defaultValue={publishDateDisplay}
                className={inputClass}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Content (BlockNote editor)</label>
            <BlockNoteEditor name="content" initialContent={article?.content} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : isEdit ? "Update" : "Create"}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/admin/articles">Cancel</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
