import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { NewsForm } from "@/features/news/components";
import { getNewsById } from "@/features/news/db/news";

type Props = {
  params: Promise<{ id: string }>;
};

async function AdminNewsEditContent({ params }: Props) {
  await connection();
  const { id } = await params;
  const news = await getNewsById(id);
  if (!news) notFound();

  return (
    <div className="space-y-5 py-2">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Edit News</h1>
        <p className="mt-0.5 text-sm text-slate-500">{news.title}</p>
      </div>
      <NewsForm key={news.id} mode="edit" news={news} />
    </div>
  );
}

export default function AdminNewsEditPage(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="animate-pulse space-y-5 py-2">
          <div className="h-8 w-48 rounded-lg bg-slate-200" />
          <div className="h-64 rounded-xl bg-white ring-1 ring-slate-200/60" />
        </div>
      }
    >
      <AdminNewsEditContent {...props} />
    </Suspense>
  );
}
