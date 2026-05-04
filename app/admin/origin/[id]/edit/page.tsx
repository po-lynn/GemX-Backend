import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { OriginForm } from "@/features/origin/components";
import { getCachedOriginById } from "@/features/origin/db/cache/origin";

type Props = {
  params: Promise<{ id: string }>;
};

async function AdminOriginEditContent({ params }: Props) {
  await connection();
  const { id } = await params;
  const origin = await getCachedOriginById(id);
  if (!origin) notFound();

  return (
    <div className="space-y-5 py-2">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Edit Origin</h1>
        <p className="mt-0.5 text-sm text-slate-500">{origin.name}</p>
      </div>
      <OriginForm key={origin.id} mode="edit" origin={origin} />
    </div>
  );
}

export default function AdminOriginEditPage(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="animate-pulse space-y-5 py-2">
          <div className="h-8 w-48 rounded-lg bg-slate-200" />
          <div className="h-64 rounded-xl bg-white ring-1 ring-slate-200/60" />
        </div>
      }
    >
      <AdminOriginEditContent {...props} />
    </Suspense>
  );
}
