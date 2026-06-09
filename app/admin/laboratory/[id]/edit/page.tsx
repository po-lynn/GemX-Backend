import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { LaboratoryForm } from "@/features/laboratory/components";
import { getCachedLaboratoryById } from "@/features/laboratory/db/cache/laboratory";
import { requireFeatureAccess } from "@/lib/admin-guard";
import { FEATURE_KEYS } from "@/features/rbac/feature-keys";

type Props = {
  params: Promise<{ id: string }>;
};

async function AdminLaboratoryEditContent({ params }: Props) {
  await connection();
  await requireFeatureAccess(FEATURE_KEYS.LABORATORY);
  const { id } = await params;
  const laboratory = await getCachedLaboratoryById(id);
  if (!laboratory) notFound();

  return <LaboratoryForm mode="edit" laboratory={laboratory} />;
}

export default function AdminLaboratoryEditPage(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="animate-pulse space-y-5 py-2">
          <div className="h-8 w-48 rounded-lg bg-slate-200" />
          <div className="h-64 rounded-xl bg-white ring-1 ring-slate-200/60" />
        </div>
      }
    >
      <AdminLaboratoryEditContent {...props} />
    </Suspense>
  );
}
