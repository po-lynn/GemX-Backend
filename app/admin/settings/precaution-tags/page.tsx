import Link from "next/link"
import { connection } from "next/server"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { ChevronRight, Plus, Download } from "lucide-react"
import { getAllPrecautionTags } from "@/features/precaution-tags/db/precaution-tags"
import { PrecautionTagsListView } from "@/features/precaution-tags/components"
import type { ViewTab } from "@/components/admin/list-view"
import { FadeUp, PressButton } from "@/components/admin/motion"

const VIEWS = ["all", "certified", "non_certified"] as const
type View = (typeof VIEWS)[number]

type Props = {
  searchParams: Promise<{ view?: string }>
}

export default async function AdminPrecautionTagsPage({ searchParams }: Props) {
  await connection()
  await requireFeatureAccess(FEATURE_KEYS.SETTINGS_PRECAUTION_TAGS)
  const params = await searchParams
  const view: View = (VIEWS as readonly string[]).includes(params.view ?? "")
    ? (params.view as View)
    : "all"

  const allTags = await getAllPrecautionTags()

  const certifiedCount   = allTags.filter((t) => t.appliesTo === "certified" || t.appliesTo === "both").length
  const nonCertifiedCount = allTags.filter((t) => t.appliesTo === "non_certified" || t.appliesTo === "both").length

  const tags =
    view === "all"          ? allTags :
    view === "certified"    ? allTags.filter((t) => t.appliesTo === "certified" || t.appliesTo === "both") :
    view === "non_certified" ? allTags.filter((t) => t.appliesTo === "non_certified" || t.appliesTo === "both") :
    allTags

  const views: ViewTab[] = [
    { id: "all",          label: "All",           count: allTags.length },
    { id: "certified",    label: "Certified",      count: certifiedCount },
    { id: "non_certified", label: "Non-Certified", count: nonCertifiedCount },
  ]

  return (
    <FadeUp>
    <div className="py-2">
      <div className="lv-pagehead">
        <div>
          <nav className="lv-breadcrumbs" aria-label="Breadcrumb">
            <Link href="/admin">Admin</Link>
            <ChevronRight />
            <Link href="/admin/settings">Settings</Link>
            <ChevronRight />
            <span className="lv-here">Precaution tags</span>
          </nav>
          <h1 className="lv-h1">
            Precaution tags
            <span className="lv-h1-count">{allTags.length} total</span>
          </h1>
          <p className="lv-subhead">
            Safety advisories shown to buyers before they chat, call or pay. Certified and non-certified gemstones surface different precautions.
          </p>
        </div>
        <div className="lv-pagehead-actions">
          <PressButton className="lv-export-btn">
            <Download /> Export Excel
          </PressButton>
          <Link href="/admin/settings/precaution-tags/new" className="lv-new-btn">
            <Plus /> New precaution
          </Link>
        </div>
      </div>

      <PrecautionTagsListView
        tags={tags}
        allTags={allTags}
        views={views}
        activeView={view}
      />
    </div>
    </FadeUp>
  )
}
