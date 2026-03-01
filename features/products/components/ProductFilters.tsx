"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"
import { SlidersHorizontal } from "lucide-react"
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
  createdFrom = "",
  createdTo = "",
  isFeatured = false,
  isCollectorPiece = false,
  isPrivilegeAssist = false,
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
    !!productType ||
    !!categoryId ||
    !!status ||
    !!stoneCut ||
    !!shape ||
    !!origin ||
    !!laboratoryId ||
    !!createdFrom ||
    !!createdTo ||
    !!isFeatured ||
    !!isCollectorPiece ||
    !!isPrivilegeAssist

  const clearFilters = useCallback(() => {
    router.push("/admin/products")
  }, [router])

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2 text-muted-foreground hover:text-foreground"
          aria-label="Open filters"
        >
          <SlidersHorizontal className="size-4 shrink-0" aria-hidden />
          <span className="text-xs font-medium uppercase tracking-wider">Filters</span>
          {hasActiveFilters && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/15 px-1.5 text-xs font-medium text-primary">
              •
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>Filters</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="filter-type" className="text-xs font-medium text-muted-foreground">
              Product type
            </label>
            <select
              id="filter-type"
              value={productType}
              onChange={(e) => updateFilter("productType", e.target.value)}
              className={`${selectClass} w-full min-w-0`}
              aria-label="Product type"
            >
              <option value="">All types</option>
              <option value="loose_stone">Loose stone</option>
              <option value="jewellery">Jewellery</option>
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="filter-category" className="text-xs font-medium text-muted-foreground">
              Category
            </label>
            <select
              id="filter-category"
              value={categoryId}
              onChange={(e) => updateFilter("categoryId", e.target.value)}
              className={`${selectClass} w-full min-w-0`}
              aria-label="Category"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="filter-status" className="text-xs font-medium text-muted-foreground">
              Status
            </label>
            <select
              id="filter-status"
              value={status}
              onChange={(e) => updateFilter("status", e.target.value)}
              className={`${selectClass} w-full min-w-0`}
              aria-label="Status"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="archive">Archive</option>
              <option value="sold">Sold</option>
              <option value="hidden">Hidden</option>
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="filter-cut" className="text-xs font-medium text-muted-foreground">
              Cut
            </label>
            <select
              id="filter-cut"
              value={stoneCut}
              onChange={(e) => updateFilter("stoneCut", e.target.value)}
              className={`${selectClass} w-full min-w-0`}
              aria-label="Cut"
            >
              <option value="">Any</option>
              {CUTS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="filter-shape" className="text-xs font-medium text-muted-foreground">
              Shape
            </label>
            <select
              id="filter-shape"
              value={shape}
              onChange={(e) => updateFilter("shape", e.target.value)}
              className={`${selectClass} w-full min-w-0`}
              aria-label="Shape"
            >
              <option value="">Any</option>
              {SHAPES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="filter-origin" className="text-xs font-medium text-muted-foreground">
              Origin
            </label>
            <select
              id="filter-origin"
              value={origin}
              onChange={(e) => updateFilter("origin", e.target.value)}
              className={`${selectClass} w-full min-w-0`}
              aria-label="Origin"
            >
              <option value="">Any</option>
              {origins.map((o) => (
                <option key={o.id} value={o.name}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <label htmlFor="filter-laboratory" className="text-xs font-medium text-muted-foreground">
              Laboratory
            </label>
            <select
              id="filter-laboratory"
              value={laboratoryId}
              onChange={(e) => updateFilter("laboratoryId", e.target.value)}
              className={`${selectClass} w-full min-w-0`}
              aria-label="Laboratory"
            >
              <option value="">Any</option>
              {laboratories.map((lab) => (
                <option key={lab.id} value={lab.id}>
                  {lab.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="filter-created-from" className="text-xs font-medium text-muted-foreground">
              Created from
            </label>
            <input
              id="filter-created-from"
              type="date"
              value={createdFrom || ""}
              onChange={(e) => updateFilter("createdFrom", e.target.value)}
              className={selectClass + " w-full min-w-0"}
              aria-label="Created from date"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="filter-created-to" className="text-xs font-medium text-muted-foreground">
              Created to
            </label>
            <input
              id="filter-created-to"
              type="date"
              value={createdTo || ""}
              onChange={(e) => updateFilter("createdTo", e.target.value)}
              className={selectClass + " w-full min-w-0"}
              aria-label="Created to date"
            />
          </div>
          <div className="space-y-3 sm:col-span-2">
            
            <div className="flex flex-wrap gap-6">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => updateFilter("isFeatured", e.target.checked ? "true" : "")}
                  className="h-4 w-4 rounded border-border"
                  aria-label="Featured only"
                />
                Featured
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isCollectorPiece}
                  onChange={(e) =>
                    updateFilter("isCollectorPiece", e.target.checked ? "true" : "")
                  }
                  className="h-4 w-4 rounded border-border"
                  aria-label="Collector piece only"
                />
                Collector Piece
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isPrivilegeAssist}
                  onChange={(e) =>
                    updateFilter("isPrivilegeAssist", e.target.checked ? "true" : "")
                  }
                  className="h-4 w-4 rounded border-border"
                  aria-label="Privilege Assist only"
                />
                Privilege Assist
              </label>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          {hasActiveFilters && (
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
