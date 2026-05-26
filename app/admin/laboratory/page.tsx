import Link from "next/link"
import { connection } from "next/server"
import { ChevronRight, Plus, Download } from "lucide-react"
import { getCachedLaboratories } from "@/features/laboratory/db/cache/laboratory"
import { LaboratoryListView } from "@/features/laboratory/components/LaboratoryListView"
import type { ViewTab } from "@/components/admin/list-view"

export default async function AdminLaboratoryPage() {
  await connection()
  const laboratories = await getCachedLaboratories()

  const views: ViewTab[] = [
    { id: "all", label: "All", count: laboratories.length },
  ]

  return (
    <div className="py-2">
      <div className="lv-pagehead">
        <div>
          <nav className="lv-breadcrumbs" aria-label="Breadcrumb">
            <Link href="/admin">Admin</Link>
            <ChevronRight />
            <span className="lv-here">Laboratory</span>
          </nav>
          <h1 className="lv-h1">
            Laboratory
            <span className="lv-h1-count">{laboratories.length} total</span>
          </h1>
          <p className="lv-subhead">
            Certification laboratories — GIA, AGS, and others — used on gemstone and diamond product certificates.
          </p>
        </div>
        <div className="lv-pagehead-actions">
          <button className="lv-export-btn">
            <Download /> Export Excel
          </button>
          <Link href="/admin/laboratory/new" className="lv-new-btn">
            <Plus /> New laboratory
          </Link>
        </div>
      </div>

      <LaboratoryListView
        laboratories={laboratories}
        views={views}
        activeView="all"
      />
    </div>
  )
}
