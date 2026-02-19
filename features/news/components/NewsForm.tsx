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
  createNewsAction,
  updateNewsAction,
} from "@/features/news/actions/news";
import type { NewsRow } from "@/features/news/db/news";

const BlockNoteEditor = dynamic(
  () =>
    import("@/features/news/components/BlockNoteEditor").then((m) => m.BlockNoteEditor),
  { ssr: false, loading: () => <div className="min-h-[280px] rounded-md border border-input bg-muted/30 animate-pulse" /> }
);

const inputClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

const STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
];

type Props = {
  mode: "create" | "edit";
  news?: NewsRow | null;
};

export function NewsForm({ mode, news }: Props) {
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
        ? await updateNewsAction(formData)
        : await createNewsAction(formData);
      if (result?.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
      await router.push("/admin/news");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const publishDisplay = news?.publish
    ? new Date(news.publish).toISOString().slice(0, 16)
    : "";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEdit ? "Edit News" : "New News"}</CardTitle>
        <CardDescription>
          {isEdit
            ? "Update the news article"
            : "Create a news article (content with BlockNote editor)"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {isEdit && news && (
            <input type="hidden" name="newsId" value={news.id} />
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
              defaultValue={news?.title ?? ""}
              placeholder="News title"
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
                defaultValue={news?.status ?? "draft"}
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
              <label htmlFor="publish" className="text-sm font-medium">
                Publish date / time
              </label>
              <input
                id="publish"
                name="publish"
                type="datetime-local"
                defaultValue={publishDisplay}
                className={inputClass}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Content (BlockNote editor)</label>
            <BlockNoteEditor name="content" initialContent={news?.content} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : isEdit ? "Update" : "Create"}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/admin/news">Cancel</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
