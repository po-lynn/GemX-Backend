"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"
import { SlidersHorizontal } from "lucide-react"

type Category = { id: string; name: string; type: string }
type Origin = { id: string; name: string; country: string }
type Laboratory = { id: string; name: string }

const SHAPES = ["Oval", "Cushion", "Round", "Pear", "Heart"] as const
const CUTS = ["Faceted", "Cabochon"] as const

type FilterKey =
  | "productType"
  | "categoryId"
  | "status"
  | "stoneCut"
  | "shape"
  | "origin"
  | "laboratoryId"

type Props = {
  categories: Category[]
  origins: Origin[]
  laboratories: Laboratory[]
  productType?: string
  categoryId?: string
  status?: string
  stoneCut?: string
  shape?: string
  origin?: string
  laboratoryId?: string
}

const selectClass =
  "h-9 rounded-lg border border-border bg-card px-3 py-1 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gem-focus)] focus-visible:ring-offset-0"

export function ProductFilters({
  categories,
  origins,
  laboratories,
  productType = "",
  categoryId = "",
  status = "",
  stoneCut = "",
  shape = "",
  origin = "",
  laboratoryId = "",
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const updateFilter = useCallback(
    (key: FilterKey, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      params.delete("page")
      router.push(`/admin/products?${params.toString()}`)
    },
    [router, searchParams]
  )

  const hasActiveFilters =
    !!productType || !!categoryId || !!status || !!stoneCut || !!shape || !!origin || !!laboratoryId

  const clearFilters = useCallback(() => {
    router.push("/admin/products")
  }, [router])

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <SlidersHorizontal className="size-4 shrink-0" aria-hidden />
        <span className="text-xs font-medium uppercase tracking-wider">Filters</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          id="filter-type"
          value={productType}
          onChange={(e) => updateFilter("productType", e.target.value)}
          className={`${selectClass} min-w-[120px]`}
          aria-label="Product type"
        >
          <option value="">All types</option>
          <option value="loose_stone">Loose stone</option>
          <option value="jewellery">Jewellery</option>
        </select>
        <select
          id="filter-category"
          value={categoryId}
          onChange={(e) => updateFilter("categoryId", e.target.value)}
          className={`${selectClass} min-w-[140px]`}
          aria-label="Category"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          id="filter-status"
          value={status}
          onChange={(e) => updateFilter("status", e.target.value)}
          className={selectClass}
          aria-label="Status"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="archive">Archive</option>
          <option value="sold">Sold</option>
          <option value="hidden">Hidden</option>
        </select>
        <select
          id="filter-cut"
          value={stoneCut}
          onChange={(e) => updateFilter("stoneCut", e.target.value)}
          className={selectClass}
          aria-label="Cut"
        >
          <option value="">Cut</option>
          {CUTS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          id="filter-shape"
          value={shape}
          onChange={(e) => updateFilter("shape", e.target.value)}
          className={selectClass}
          aria-label="Shape"
        >
          <option value="">Shape</option>
          {SHAPES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          id="filter-origin"
          value={origin}
          onChange={(e) => updateFilter("origin", e.target.value)}
          className={`${selectClass} min-w-[120px]`}
          aria-label="Origin"
        >
          <option value="">Origin</option>
          {origins.map((o) => (
            <option key={o.id} value={o.name}>
              {o.name}
            </option>
          ))}
        </select>
        <select
          id="filter-laboratory"
          value={laboratoryId}
          onChange={(e) => updateFilter("laboratoryId", e.target.value)}
          className={`${selectClass} min-w-[140px]`}
          aria-label="Laboratory"
        >
          <option value="">Laboratory</option>
          {laboratories.map((lab) => (
            <option key={lab.id} value={lab.id}>
              {lab.name}
            </option>
          ))}
        </select>
      </div>
      {hasActiveFilters && (
        <button
          type="button"
          onClick={clearFilters}
          className="text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
