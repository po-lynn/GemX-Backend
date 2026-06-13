import Link from "next/link"
import { connection } from "next/server"
import { requireAdmin } from "@/lib/admin-guard"
import { ChevronRight, Plus, Download } from "lucide-react"
import { getAllCategories } from "@/features/categories/db/categories"
import { CategoriesListView } from "@/features/categories/components/CategoriesListView"
import type { ViewTab } from "@/components/admin/list-view"
import { FadeUp, PressButton } from "@/components/admin/motion"

const VIEWS = ["all", "loose_stone", "jewellery"] as const
type View = (typeof VIEWS)[number]

type Props = {
  searchParams: Promise<{ view?: string; page?: string }>
}

export default async function AdminCategoriesPage({ searchParams }: Props) {
  await connection()
  await requireAdmin()
  const params = await searchParams
  const view: View = (VIEWS as readonly string[]).includes(params.view ?? "")
    ? (params.view as View)
    : "all"

  const allCategories = await getAllCategories()

  const looseCount = allCategories.filter((c) => c.type === "loose_stone").length
  const jewelleryCount = allCategories.filter((c) => c.type === "jewellery").length

  const categories =
    view === "all" ? allCategories : allCategories.filter((c) => c.type === view)

  const views: ViewTab[] = [
    { id: "all",         label: "All",         count: allCategories.length },
    { id: "loose_stone", label: "Loose stone",  count: looseCount },
    { id: "jewellery",   label: "Jewellery",    count: jewelleryCount },
  ]

  return (
    <FadeUp>
    <div className="py-2">
      <div className="lv-pagehead">
        <div>
          <nav className="lv-breadcrumbs" aria-label="Breadcrumb">
            <Link href="/admin">Admin</Link>
            <ChevronRight />
            <span className="lv-here">Categories</span>
          </nav>
          <h1 className="lv-h1">
            Categories
            <span className="lv-h1-count">{allCategories.length} total</span>
          </h1>
          <p className="lv-subhead">
            Loose stone &amp; jewellery taxonomies used by products. Manage ordering and codes.
          </p>
        </div>
        <div className="lv-pagehead-actions">
          <PressButton className="lv-export-btn">
            <Download /> Export Excel
          </PressButton>
          <Link href="/admin/categories/new" className="lv-new-btn">
            <Plus /> New category
          </Link>
        </div>
      </div>

      <CategoriesListView
        categories={categories}
        allCategories={allCategories}
        views={views}
        activeView={view}
      />
    </div>
    </FadeUp>
  )
}
