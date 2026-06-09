import Link from "next/link"
import { connection } from "next/server"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { ChevronRight, Plus, Download } from "lucide-react"
import { getCachedRatingTags } from "@/features/rating-tags/db/cache/rating-tags"
import { RatingTagsListView } from "@/features/rating-tags/components/RatingTagsListView"
import type { ViewTab } from "@/components/admin/list-view"

const VIEWS = ["all", "positive", "neutral", "negative"] as const
type View = (typeof VIEWS)[number]

type Props = {
  searchParams: Promise<{ view?: string }>
}

export default async function AdminRatingTagsPage({ searchParams }: Props) {
  await connection()
  await requireFeatureAccess(FEATURE_KEYS.SETTINGS_RATING_TAGS)
  const params = await searchParams
  const view: View = (VIEWS as readonly string[]).includes(params.view ?? "")
    ? (params.view as View)
    : "all"

  const allTags = await getCachedRatingTags()

  const positiveCount = allTags.filter((t) => t.type === "positive").length
  const neutralCount  = allTags.filter((t) => t.type === "neutral").length
  const negativeCount = allTags.filter((t) => t.type === "negative").length

  const tags =
    view === "all" ? allTags : allTags.filter((t) => t.type === view)

  const views: ViewTab[] = [
    { id: "all",      label: "All",      count: allTags.length },
    { id: "positive", label: "Positive", count: positiveCount },
    { id: "neutral",  label: "Neutral",  count: neutralCount },
    { id: "negative", label: "Negative", count: negativeCount },
  ]

  return (
    <div className="py-2">
      <div className="lv-pagehead">
        <div>
          <nav className="lv-breadcrumbs" aria-label="Breadcrumb">
            <Link href="/admin">Admin</Link>
            <ChevronRight />
            <Link href="/admin/settings">Settings</Link>
            <ChevronRight />
            <span className="lv-here">Rating tags</span>
          </nav>
          <h1 className="lv-h1">
            Rating tags
            <span className="lv-h1-count">{allTags.length} total</span>
          </h1>
          <p className="lv-subhead">
            Preset tags buyers pick when rating sellers. Hidden tags stay in the system but are not offered to users.
          </p>
        </div>
        <div className="lv-pagehead-actions">
          <button className="lv-export-btn">
            <Download /> Export Excel
          </button>
          <Link href="/admin/settings/rating-tags/new" className="lv-new-btn">
            <Plus /> New tag
          </Link>
        </div>
      </div>

      <RatingTagsListView
        tags={tags}
        allTags={allTags}
        views={views}
        activeView={view}
      />
    </div>
  )
}
