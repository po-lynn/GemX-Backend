import Link from "next/link"
import { connection } from "next/server"
import { ChevronRight, Plus, Download } from "lucide-react"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { getAllOrigins } from "@/features/origin/db/origin"
import { OriginListView } from "@/features/origin/components/OriginListView"
import type { ViewTab } from "@/components/admin/list-view"
import { FadeUp, PressButton } from "@/components/admin/motion"

const VIEWS = ["all", "myanmar", "other"] as const
type View = (typeof VIEWS)[number]

type Props = {
  searchParams: Promise<{ view?: string }>
}

export default async function AdminOriginPage({ searchParams }: Props) {
  await connection()
  await requireFeatureAccess(FEATURE_KEYS.ORIGIN)
  const params = await searchParams
  const view: View = (VIEWS as readonly string[]).includes(params.view ?? "")
    ? (params.view as View)
    : "all"

  const allOrigins = await getAllOrigins()

  const myanmarCount = allOrigins.filter((o) => o.country === "Myanmar").length
  const otherCount   = allOrigins.filter((o) => o.country !== "Myanmar").length

  const origins =
    view === "myanmar" ? allOrigins.filter((o) => o.country === "Myanmar")
    : view === "other" ? allOrigins.filter((o) => o.country !== "Myanmar")
    : allOrigins

  const views: ViewTab[] = [
    { id: "all",     label: "All",     count: allOrigins.length },
    { id: "myanmar", label: "Myanmar", count: myanmarCount },
    { id: "other",   label: "Other",   count: otherCount },
  ]

  return (
    <FadeUp>
    <div className="py-2">
      <div className="lv-pagehead">
        <div>
          <nav className="lv-breadcrumbs" aria-label="Breadcrumb">
            <Link href="/admin">Admin</Link>
            <ChevronRight />
            <span className="lv-here">Origin</span>
          </nav>
          <h1 className="lv-h1">
            Origin
            <span className="lv-h1-count">{allOrigins.length} total</span>
          </h1>
          <p className="lv-subhead">
            Gem origins — Myanmar (Mogok, Mong Hsu) and international — used on product certificates.
          </p>
        </div>
        <div className="lv-pagehead-actions">
          <PressButton className="lv-export-btn">
            <Download /> Export Excel
          </PressButton>
          <Link href="/admin/origin/new" className="lv-new-btn">
            <Plus /> New origin
          </Link>
        </div>
      </div>

      <OriginListView
        origins={origins}
        allOrigins={allOrigins}
        views={views}
        activeView={view}
      />
    </div>
    </FadeUp>
  )
}
