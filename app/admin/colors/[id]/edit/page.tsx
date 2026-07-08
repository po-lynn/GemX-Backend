import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ColorForm } from "@/features/colors/components";
import { getCachedColorById } from "@/features/colors/db/cache/color";
import { requireFeatureAccess } from "@/lib/admin-guard";
import { FEATURE_KEYS } from "@/features/rbac/feature-keys";
import { FadeUp } from "@/components/admin/motion";
import { resolveAdjacentColors } from "./resolve-adjacent";

type Props = {
  params: Promise<{ id: string }>;
};

async function AdminColorEditContent({ params }: Props) {
  await connection();
  await requireFeatureAccess(FEATURE_KEYS.COLOR);
  const { id } = await params;
  const [color, adjacent] = await Promise.all([
    getCachedColorById(id),
    resolveAdjacentColors(id),
  ]);
  if (!color) notFound();

  return (
    <ColorForm
      key={color.id}
      mode="edit"
      color={color}
      prevHref={adjacent.prevHref}
      nextHref={adjacent.nextHref}
      listPosition={adjacent.position}
      listTotal={adjacent.total}
    />
  );
}

export default function AdminColorEditPage(props: Props) {
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
        <AdminColorEditContent {...props} />
      </Suspense>
    </FadeUp>
  );
}
