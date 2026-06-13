import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { OriginForm } from "@/features/origin/components";
import { getCachedOriginById } from "@/features/origin/db/cache/origin";
import { requireFeatureAccess } from "@/lib/admin-guard";
import { FEATURE_KEYS } from "@/features/rbac/feature-keys";
import { FadeUp } from "@/components/admin/motion";

type Props = {
  params: Promise<{ id: string }>;
};

async function AdminOriginEditContent({ params }: Props) {
  await connection();
  await requireFeatureAccess(FEATURE_KEYS.ORIGIN);
  const { id } = await params;
  const origin = await getCachedOriginById(id);
  if (!origin) notFound();

  return <OriginForm key={origin.id} mode="edit" origin={origin} />;
}

export default function AdminOriginEditPage(props: Props) {
  return (
    <FadeUp>
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
    </FadeUp>
  );
}
