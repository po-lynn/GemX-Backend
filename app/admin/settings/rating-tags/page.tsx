import Link from "next/link"
import { connection } from "next/server"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getCachedRatingTags } from "@/features/rating-tags/db/cache/rating-tags"
import { RatingTagsTable } from "@/features/rating-tags/components"

export default async function AdminRatingTagsPage() {
  await connection()
  const ratingTags = await getCachedRatingTags()

  return (
    <div className="space-y-5 py-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Seller rating tags
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Positive and negative presets for seller ratings. Hidden tags stay in
            the database but are not offered to users.
          </p>
        </div>
        <Button asChild size="sm" className="shrink-0 shadow-sm">
          <Link href="/admin/settings/rating-tags/new">
            <Plus className="mr-1.5 size-4" />
            New tag
          </Link>
        </Button>
      </div>

      <RatingTagsTable ratingTags={ratingTags} />
    </div>
  )
}
