"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"

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
  "h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"

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

  return (
    <div className="mt-2 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <label htmlFor="filter-type" className="text-sm font-medium text-muted-foreground">
          Type
        </label>
        <select
          id="filter-type"
          value={productType}
          onChange={(e) => updateFilter("productType", e.target.value)}
          className={selectClass}
        >
          <option value="">All</option>
          <option value="loose_stone">Loose stone</option>
          <option value="jewellery">Jewellery</option>
        </select>
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="filter-category" className="text-sm font-medium text-muted-foreground">
          Category
        </label>
        <select
          id="filter-category"
          value={categoryId}
          onChange={(e) => updateFilter("categoryId", e.target.value)}
          className={`${selectClass} min-w-[140px]`}
        >
          <option value="">All</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="filter-status" className="text-sm font-medium text-muted-foreground">
          Status
        </label>
        <select
          id="filter-status"
          value={status}
          onChange={(e) => updateFilter("status", e.target.value)}
          className={selectClass}
        >
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="archive">Archive</option>
          <option value="sold">Sold</option>
          <option value="hidden">Hidden</option>
        </select>
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="filter-cut" className="text-sm font-medium text-muted-foreground">
          Cut
        </label>
        <select
          id="filter-cut"
          value={stoneCut}
          onChange={(e) => updateFilter("stoneCut", e.target.value)}
          className={selectClass}
        >
          <option value="">All</option>
          {CUTS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="filter-shape" className="text-sm font-medium text-muted-foreground">
          Shape
        </label>
        <select
          id="filter-shape"
          value={shape}
          onChange={(e) => updateFilter("shape", e.target.value)}
          className={selectClass}
        >
          <option value="">All</option>
          {SHAPES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="filter-origin" className="text-sm font-medium text-muted-foreground">
          Origin
        </label>
        <select
          id="filter-origin"
          value={origin}
          onChange={(e) => updateFilter("origin", e.target.value)}
          className={`${selectClass} min-w-[120px]`}
        >
          <option value="">All</option>
          {origins.map((o) => (
            <option key={o.id} value={o.name}>
              {o.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="filter-laboratory" className="text-sm font-medium text-muted-foreground">
          Laboratory
        </label>
        <select
          id="filter-laboratory"
          value={laboratoryId}
          onChange={(e) => updateFilter("laboratoryId", e.target.value)}
          className={`${selectClass} min-w-[140px]`}
        >
          <option value="">All</option>
          {laboratories.map((lab) => (
            <option key={lab.id} value={lab.id}>
              {lab.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
