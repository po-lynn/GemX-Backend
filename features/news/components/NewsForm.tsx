"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  AdminFormSection,
  AdminFormError,
  adminInput,
  adminSelect,
  adminLabel,
  adminFieldClass,
} from "@/components/admin/admin-ui";
import { createNewsAction, updateNewsAction } from "@/features/news/actions/news";
import type { NewsRow } from "@/features/news/db/news";
import DatePicker from "@/components/date-picker/date-picker";

const BlockNoteEditor = dynamic(
  () => import("@/features/news/components/BlockNoteEditor").then((m) => m.BlockNoteEditor),
  { ssr: false, loading: () => <div className="min-h-[280px] animate-pulse rounded-lg bg-slate-100" /> }
);

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
    const formData = new FormData(e.currentTarget);
    try {
      const result = isEdit ? await updateNewsAction(formData) : await createNewsAction(formData);
      if (result?.error) { setError(result.error); return; }
      await router.push("/admin/news");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const publishDateValue = news?.publish ? new Date(news.publish).toISOString().slice(0, 10) : "";

  return (
    <div className="max-w-3xl space-y-5">
      <form onSubmit={handleSubmit}>
        {isEdit && news && <input type="hidden" name="newsId" value={news.id} />}
        <AdminFormSection
          title={isEdit ? "Edit news article" : "New news article"}
          description={isEdit ? "Update the news content" : "Create a news article with the BlockNote editor"}
        >
          <div className="space-y-4">
            <div className={adminFieldClass}>
              <label htmlFor="title" className={adminLabel}>Title *</label>
              <input
                id="title" name="title" type="text" required maxLength={500}
                defaultValue={news?.title ?? ""} placeholder="News title"
                className={adminInput}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className={adminFieldClass}>
                <label htmlFor="status" className={adminLabel}>Status</label>
                <select id="status" name="status" defaultValue={news?.status ?? "draft"} className={adminSelect}>
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className={adminFieldClass}>
                <label htmlFor="publish" className={adminLabel}>Publish date</label>
                <DatePicker
                  id="publish" name="publish" value={publishDateValue}
                  placeholder="Pick publish date" className="w-full"
                />
              </div>
            </div>

            <div className={adminFieldClass}>
              <label className={adminLabel}>Content</label>
              <BlockNoteEditor name="content" initialContent={news?.content} />
            </div>
          </div>
        </AdminFormSection>

        <AdminFormError error={error} />

        <div className="mt-5 flex gap-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Saving…" : isEdit ? "Update" : "Create"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/admin/news">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
