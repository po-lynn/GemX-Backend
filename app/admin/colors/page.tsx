import Link from "next/link"
import { connection } from "next/server"
import { ChevronRight, Plus } from "lucide-react"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { getAllColors } from "@/features/colors/db/color"
import { ColorListView } from "@/features/colors/components/ColorListView"
import type { ViewTab } from "@/components/admin/list-view"
import { FadeUp } from "@/components/admin/motion"

export default async function AdminColorsPage() {
  await connection()
  await requireFeatureAccess(FEATURE_KEYS.COLOR)

  const colors = await getAllColors()

  const views: ViewTab[] = [
    { id: "all", label: "All", count: colors.length },
  ]

  return (
    <FadeUp>
    <div className="py-2">
      <div className="lv-pagehead">
        <div>
          <nav className="lv-breadcrumbs" aria-label="Breadcrumb">
            <Link href="/admin">Admin</Link>
            <ChevronRight />
            <span className="lv-here">Color</span>
          </nav>
          <h1 className="lv-h1">
            Color
            <span className="lv-h1-count">{colors.length} total</span>
          </h1>
          <p className="lv-subhead">
            Product colours for gemstones, loose stones, and jewellery — shown as pickers in the apps.
          </p>
        </div>
        <div className="lv-pagehead-actions">
          <Link href="/admin/colors/new" className="lv-new-btn">
            <Plus /> New colour
          </Link>
        </div>
      </div>

      <ColorListView colors={colors} views={views} activeView="all" />
    </div>
    </FadeUp>
  )
}
