"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"
import { SlidersHorizontal, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

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
  | "createdFrom"
  | "createdTo"
  | "isFeatured"
  | "isCollectorPiece"
  | "isPrivilegeAssist"

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
  createdFrom?: string
  createdTo?: string
  isFeatured?: boolean
  isCollectorPiece?: boolean
  isPrivilegeAssist?: boolean
  listPath?: string
}

const fieldClass =
  "h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm text-slate-800 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/50"

const labelClass = "text-xs font-medium text-slate-500"

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
  createdFrom = "",
  createdTo = "",
  isFeatured = false,
  isCollectorPiece = false,
  isPrivilegeAssist = false,
  listPath = "/admin/products",
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const listBase = listPath.replace(/\/$/, "")

  const updateFilter = useCallback(
    (key: FilterKey, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) params.set(key, value)
      else params.delete(key)
      params.delete("page")
      router.push(`${listBase}?${params.toString()}`)
    },
    [router, searchParams, listBase]
  )

  const hasActiveFilters =
    !!productType || !!categoryId || !!status || !!stoneCut || !!shape ||
    !!origin || !!laboratoryId || !!createdFrom || !!createdTo ||
    !!isFeatured || !!isCollectorPiece || !!isPrivilegeAssist

  const activeCount = [
    productType, categoryId, status, stoneCut, shape, origin, laboratoryId,
    createdFrom, createdTo,
    isFeatured ? "1" : "",
    isCollectorPiece ? "1" : "",
    isPrivilegeAssist ? "1" : "",
  ].filter(Boolean).length

  const clearFilters = useCallback(() => {
    router.push(listBase)
  }, [router, listBase])

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 shadow-sm transition-all hover:border-slate-300 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          aria-label="Open filters"
        >
          <SlidersHorizontal className="size-3.5 shrink-0" aria-hidden />
          <span className="font-medium">Filters</span>
          {hasActiveFilters && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/15 px-1.5 text-[11px] font-semibold text-primary">
              {activeCount}
            </span>
          )}
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle className="text-base">Filter Products</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="filter-type" className={labelClass}>Product type</label>
            <select
              id="filter-type"
              value={productType}
              onChange={(e) => updateFilter("productType", e.target.value)}
              className={fieldClass}
            >
              <option value="">All types</option>
              <option value="loose_stone">Loose stone</option>
              <option value="jewellery">Jewellery</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="filter-category" className={labelClass}>Category</label>
            <select
              id="filter-category"
              value={categoryId}
              onChange={(e) => updateFilter("categoryId", e.target.value)}
              className={fieldClass}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="filter-status" className={labelClass}>Status</label>
            <select
              id="filter-status"
              value={status}
              onChange={(e) => updateFilter("status", e.target.value)}
              className={fieldClass}
            >
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="archive">Archive</option>
              <option value="sold">Sold</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="filter-cut" className={labelClass}>Cut</label>
            <select
              id="filter-cut"
              value={stoneCut}
              onChange={(e) => updateFilter("stoneCut", e.target.value)}
              className={fieldClass}
            >
              <option value="">Any</option>
              {CUTS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="filter-shape" className={labelClass}>Shape</label>
            <select
              id="filter-shape"
              value={shape}
              onChange={(e) => updateFilter("shape", e.target.value)}
              className={fieldClass}
            >
              <option value="">Any</option>
              {SHAPES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="filter-origin" className={labelClass}>Origin</label>
            <select
              id="filter-origin"
              value={origin}
              onChange={(e) => updateFilter("origin", e.target.value)}
              className={fieldClass}
            >
              <option value="">Any</option>
              {origins.map((o) => <option key={o.id} value={o.name}>{o.name}</option>)}
            </select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="filter-laboratory" className={labelClass}>Laboratory</label>
            <select
              id="filter-laboratory"
              value={laboratoryId}
              onChange={(e) => updateFilter("laboratoryId", e.target.value)}
              className={fieldClass}
            >
              <option value="">Any</option>
              {laboratories.map((lab) => (
                <option key={lab.id} value={lab.id}>{lab.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="filter-created-from" className={labelClass}>Created from</label>
            <input
              id="filter-created-from"
              type="date"
              value={createdFrom || ""}
              onChange={(e) => updateFilter("createdFrom", e.target.value)}
              className={fieldClass}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="filter-created-to" className={labelClass}>Created to</label>
            <input
              id="filter-created-to"
              type="date"
              value={createdTo || ""}
              onChange={(e) => updateFilter("createdTo", e.target.value)}
              className={fieldClass}
            />
          </div>

          <div className="space-y-2.5 sm:col-span-2">
            <p className={labelClass}>Boolean flags</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: "isFeatured" as FilterKey, label: "Featured", checked: isFeatured },
                { key: "isCollectorPiece" as FilterKey, label: "Collector Piece", checked: isCollectorPiece },
                { key: "isPrivilegeAssist" as FilterKey, label: "Privilege Assist", checked: isPrivilegeAssist },
              ].map(({ key, label, checked }) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => updateFilter(key, e.target.checked ? "true" : "")}
                    className="h-4 w-4 rounded border-slate-300 accent-primary"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="gap-1.5 text-slate-500 hover:text-slate-700"
            >
              <X className="size-3.5" />
              Clear all filters
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
