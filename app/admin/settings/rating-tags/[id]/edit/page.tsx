import { Suspense } from "react"
import { notFound } from "next/navigation"
import { connection } from "next/server"
import { RatingTagForm } from "@/features/rating-tags/components"
import { getCachedRatingTagById } from "@/features/rating-tags/db/cache/rating-tags"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"

type Props = {
  params: Promise<{ id: string }>
}

async function AdminRatingTagEditContent({ params }: Props) {
  await connection()
  await requireFeatureAccess(FEATURE_KEYS.SETTINGS_RATING_TAGS)
  const { id } = await params
  const row = await getCachedRatingTagById(id)
  if (!row) notFound()

  return <RatingTagForm key={row.id} mode="edit" ratingTag={row} />
}

export default function AdminRatingTagEditPage(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="animate-pulse space-y-5 py-2">
          <div className="h-8 w-48 rounded-lg bg-slate-200" />
          <div className="h-64 rounded-xl bg-white ring-1 ring-slate-200/60" />
        </div>
      }
    >
      <AdminRatingTagEditContent {...props} />
    </Suspense>
  )
}
