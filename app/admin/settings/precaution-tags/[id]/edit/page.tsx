import { Suspense } from "react"
import { notFound } from "next/navigation"
import { connection } from "next/server"
import { PrecautionTagForm } from "@/features/precaution-tags/components"
import { getCachedPrecautionTagById } from "@/features/precaution-tags/db/cache/precaution-tags"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"

type Props = {
  params: Promise<{ id: string }>
}

async function AdminPrecautionTagEditContent({ params }: Props) {
  await connection()
  await requireFeatureAccess(FEATURE_KEYS.SETTINGS_PRECAUTION_TAGS)
  const { id } = await params
  const row = await getCachedPrecautionTagById(id)
  if (!row) notFound()

  return <PrecautionTagForm key={row.id} mode="edit" precautionTag={row} />
}

export default function AdminPrecautionTagEditPage(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="animate-pulse space-y-5 py-2">
          <div className="h-8 w-48 rounded-lg bg-slate-200" />
          <div className="h-64 rounded-xl bg-white ring-1 ring-slate-200/60" />
        </div>
      }
    >
      <AdminPrecautionTagEditContent {...props} />
    </Suspense>
  )
}
