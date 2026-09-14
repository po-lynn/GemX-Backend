import Link from "next/link"
import { connection } from "next/server"
import { ChevronRight, Plus, Download } from "lucide-react"
import { requireFeatureAccess } from "@/lib/admin-guard"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { getAllProductShapes } from "@/features/product-shape/db/product-shape"
import { ProductShapeListView } from "@/features/product-shape/components/ProductShapeListView"
import type { ViewTab } from "@/components/admin/list-view"
import { FadeUp, PressButton } from "@/components/admin/motion"

export default async function AdminProductShapePage() {
  await connection()
  await requireFeatureAccess(FEATURE_KEYS.PRODUCT_SHAPE)
  const shapes = await getAllProductShapes()

  const views: ViewTab[] = [{ id: "all", label: "All", count: shapes.length }]

  return (
    <FadeUp>
      <div className="py-2">
        <div className="lv-pagehead">
          <div>
            <nav className="lv-breadcrumbs" aria-label="Breadcrumb">
              <Link href="/admin">Admin</Link>
              <ChevronRight />
              <span className="lv-here">Product Shape</span>
            </nav>
            <h1 className="lv-h1">
              Product Shape
              <span className="lv-h1-count">{shapes.length} total</span>
            </h1>
            <p className="lv-subhead">
              Gemstone shapes — Oval, Round, Pear, and more — used on product
              listings and filters.
            </p>
          </div>
          <div className="lv-pagehead-actions">
            <PressButton className="lv-export-btn">
              <Download /> Export Excel
            </PressButton>
            <Link href="/admin/product-shape/new" className="lv-new-btn">
              <Plus /> New shape
            </Link>
          </div>
        </div>

        <ProductShapeListView shapes={shapes} views={views} activeView="all" />
      </div>
    </FadeUp>
  )
}
