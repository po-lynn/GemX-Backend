"use client"

import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { useRef, useState } from "react"
import { Check, X, Archive } from "lucide-react"
import { toast } from "sonner"
import { formatDate } from "@/lib/formatters"
import { ListViewCard } from "@/components/admin/list-view"
import type { ColumnDef, ViewTab, FilterDef, GroupOption } from "@/components/admin/list-view"
import type { AdminProductRow } from "@/features/products/db/products"
import {
  bulkSetProductModeration,
  bulkSetProductStatus,
} from "@/features/products/actions/products"

// ─── Helpers ──────────────────────────────────────────────

function fmtRelative(d: Date): string {
  const diff = (Date.now() - new Date(d).getTime()) / 1000
  if (diff < 60)         return "just now"
  if (diff < 3600)       return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400)      return `${Math.floor(diff / 3600)}h ago`
  if (diff < 7 * 86400)  return `${Math.floor(diff / 86400)}d ago`
  if (diff < 30 * 86400) return `${Math.floor(diff / (7 * 86400))}w ago`
  return formatDate(d)
}

function getInitials(name: string): string {
  return name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("")
}

function getHue(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 6
  return h + 1
}

// Derive a gem hue (0–360) from a string for consistent coloring
function getGemHue(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 47 + str.charCodeAt(i)) & 0xffff
  return (h % 320) + 20
}

// ─── Product thumbnail ─────────────────────────────────────

function ProductThumb({ row }: { row: AdminProductRow }) {
  if (row.imageUrl) {
    return (
      <Image
        src={row.imageUrl}
        alt=""
        width={44}
        height={44}
        className="prod-thumb-img"
      />
    )
  }
  const hue = getGemHue(row.categoryId ?? row.title)
  const letters = row.title.replace(/[^A-Z0-9]/gi, "").slice(0, 2).toUpperCase() || "GX"
  return (
    <div className="prod-thumb" style={{ "--gem-hue": hue } as React.CSSProperties}>
      <span className="prod-thumb-letters">{letters}</span>
    </div>
  )
}

// ─── Flag badges ───────────────────────────────────────────

function ProductFlags({ row }: { row: AdminProductRow }) {
  const flags = [
    row.isFeatured      && <span key="f" className="prod-flag featured">Featured</span>,
    row.isCollectorPiece && <span key="c" className="prod-flag collector">Collector</span>,
    row.isPrivilegeAssist && <span key="p" className="prod-flag privilege">Privilege</span>,
    row.isPromotion      && <span key="r" className="prod-flag promotion">Promo</span>,
  ].filter(Boolean)
  if (!flags.length) return <span style={{ color: "var(--lv-text-4)", fontSize: 12 }}>—</span>
  return <span className="prod-flags">{flags}</span>
}

// ─── Status pill with product-specific labels ──────────────

const STATUS_LABELS: Record<string, string> = {
  active:   "Active",
  pending:  "Pending",
  sold:     "Sold",
  archive:  "Archived",
  hidden:   "Hidden",
  approved: "Approved",
  rejected: "Rejected",
}

function ProductStatusPill({ status }: { status: string }) {
  return <span className={`lv-status ${status}`}>{STATUS_LABELS[status] ?? status}</span>
}

// ─── Build view URL ────────────────────────────────────────

const BASE = "/admin/products"

function buildViewHref(view: string, search?: string): string {
  const p = new URLSearchParams()
  if (view !== "all") p.set("view", view)
  if (search?.trim()) p.set("search", search.trim())
  p.set("page", "1")
  return `${BASE}?${p.toString()}`
}

function buildPageHref(page: number, view: string, search?: string): string {
  const p = new URLSearchParams()
  if (view !== "all") p.set("view", view)
  if (search?.trim()) p.set("search", search.trim())
  p.set("page", String(page))
  return `${BASE}?${p.toString()}`
}

// ─── Main component ────────────────────────────────────────

type Props = {
  products: AdminProductRow[]
  views: ViewTab[]
  activeView: string
  page: number
  pageSize: number
  total: number
  search?: string
  priceMinUSD?: string
  priceMaxUSD?: string
  priceMinMMK?: string
  priceMaxMMK?: string
}

export function ProductsListView({
  products,
  views,
  activeView,
  page,
  pageSize,
  total,
  search,
  priceMinUSD,
  priceMaxUSD,
  priceMinMMK,
  priceMaxMMK,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentSearch = search ?? searchParams.get("search") ?? ""
  const isArchiveView = searchParams.get("status") === "archive"

  const defaultPriceFilters: Record<string, string[]> = {}
  if (priceMinUSD || priceMaxUSD) {
    defaultPriceFilters.priceUSD = [
      ...(priceMinUSD ? [`min:${priceMinUSD}`] : []),
      ...(priceMaxUSD ? [`max:${priceMaxUSD}`] : []),
    ]
  }
  if (priceMinMMK || priceMaxMMK) {
    defaultPriceFilters.priceMMK = [
      ...(priceMinMMK ? [`min:${priceMinMMK}`] : []),
      ...(priceMaxMMK ? [`max:${priceMaxMMK}`] : []),
    ]
  }
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [pendingAction, setPendingAction] = useState<string | null>(null)

  function handleSearch(q: string) {
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => {
      router.push(buildPageHref(1, activeView, q))
    }, 400)
  }
  const isPending = pendingAction !== null

  async function runBulk(action: string, fn: () => Promise<unknown>, onClear: () => void, count?: number) {
    if (isPending) return
    setPendingAction(action)
    try {
      await fn()
      onClear()
      router.refresh()
      const n = count ?? 1
      const successMap: Record<string, { title: string; description: string }> = {
        approve: { title: `${n} product${n > 1 ? "s" : ""} approved`,  description: "Moderation status set to approved." },
        reject:  { title: `${n} product${n > 1 ? "s" : ""} rejected`,  description: "Moderation status set to rejected." },
        archive: { title: `${n} product${n > 1 ? "s" : ""} archived`,  description: "Listing removed from the active view." },
      }
      const msg = successMap[action] ?? { title: `${n} product${n > 1 ? "s" : ""} updated`, description: "" }
      toast.success(msg.title, { description: msg.description })
    } catch {
      toast.error("Bulk action failed", {
        description: "Please try again or refresh the page.",
      })
    } finally {
      setPendingAction(null)
    }
  }

  const columnDefs: ColumnDef<AdminProductRow>[] = [
    {
      id: "product",
      label: "Product",
      flex: true,
      sortable: true,
      render: (r) => (
        <div className="lv-cell-user">
          <ProductThumb row={r} />
          <div className="lv-cell-user-meta">
            <span className="lv-cell-name" title={r.title}>{r.title}</span>
            <span className="lv-cell-sub prod-sku">
              {r.sku && <><span>{r.sku}</span><span className="prod-sku-dot" /></>}
              <span>{r.id.slice(0, 12)}</span>
            </span>
          </div>
        </div>
      ),
    },
    {
      id: "type",
      label: "Type",
      width: 190,
      sortable: true,
      render: (r) => {
        const hue = getGemHue(r.categoryId ?? r.title)
        return (
          <span className="prod-type">
            <span className="prod-type-tile" style={{ "--gem-hue": hue } as React.CSSProperties}>
              {r.productType === "jewellery" ? (
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 4 2-2 2 2-2 2z"/><circle cx="8" cy="10.5" r="3.5"/>
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 2.5h8L14 6 8 13.5 2 6z"/><path d="M2 6h12M6 6 8 13.5 10 6M6 6l2-3.5 2 3.5"/>
                </svg>
              )}
            </span>
            <span>
              <span className="prod-type-cat">{r.categoryName ?? "—"}</span>
              <span className="prod-type-sep"> · </span>
              <span className="prod-type-base">{r.productType === "loose_stone" ? "Loose Stone" : "Jewellery"}</span>
            </span>
          </span>
        )
      },
    },
    {
      id: "price",
      label: "Price",
      width: 130,
      sortable: true,
      align: "right",
      render: (r) => {
        const price = Number(r.price)
        return (
          <span className="prod-price">
            <span className="prod-price-main">
              {r.currency} {price.toLocaleString()}
            </span>
            {r.promotionComparePrice && (
              <span className="prod-price-sub promo">
                was {Number(r.promotionComparePrice).toLocaleString()}
              </span>
            )}
          </span>
        )
      },
    },
    {
      id: "status",
      label: "Status",
      width: 110,
      sortable: true,
      render: (r) => <ProductStatusPill status={r.status} />,
    },
    {
      id: "moderation",
      label: "Moderation",
      width: 120,
      sortable: true,
      render: (r) => <ProductStatusPill status={r.moderationStatus} />,
    },
    {
      id: "flags",
      label: "Flags",
      width: 190,
      sortable: false,
      render: (r) => <ProductFlags row={r} />,
    },
    {
      id: "seller",
      label: "Seller",
      width: 200,
      sortable: true,
      render: (r) => (
        <div className="lv-cell-user">
          <span className="lv-avatar" data-hue={getHue(r.sellerId)}>
            {getInitials(r.sellerName)}
          </span>
          <div className="lv-cell-user-meta">
            <span className="lv-cell-name">{r.sellerName}</span>
            {r.sellerPhone && <span className="lv-cell-sub">{r.sellerPhone}</span>}
          </div>
        </div>
      ),
    },
    {
      id: "createdAt",
      label: "Created",
      width: 140,
      sortable: true,
      render: (r) => (
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
          <span style={{ fontSize: 12.5, color: "var(--lv-text)", fontVariantNumeric: "tabular-nums" }}>
            {formatDate(r.createdAt)}
          </span>
          <span style={{ fontSize: 10.5, color: "var(--lv-text-3)" }}>
            {fmtRelative(r.createdAt)}
          </span>
        </div>
      ),
    },
  ]

  // Build filter options from data
  const uniqueCategories = Array.from(
    new Map(products.filter((p) => p.categoryName).map((p) => [p.categoryId, p.categoryName])).entries()
  ).map(([id, name]) => ({
    value: id ?? "",
    label: name ?? "",
    count: products.filter((p) => p.categoryId === id).length,
  }))

  const filterDefs: FilterDef[] = [
    {
      id: "type",
      label: "Type",
      type: "multi",
      options: [
        { value: "loose_stone", label: "Loose Stone", count: products.filter((p) => p.productType === "loose_stone").length },
        { value: "jewellery",   label: "Jewellery",   count: products.filter((p) => p.productType === "jewellery").length },
      ],
    },
    {
      id: "category",
      label: "Category",
      type: "multi",
      options: uniqueCategories,
    },
    {
      id: "status",
      label: "Status",
      type: "multi",
      options: (["active", "pending", "sold", "hidden", "archive"] as const).map((s) => ({
        value: s,
        label: STATUS_LABELS[s] ?? s,
        count: products.filter((p) => p.status === s).length,
      })),
    },
    {
      id: "moderation",
      label: "Moderation",
      type: "multi",
      options: (["pending", "approved", "rejected"] as const).map((s) => ({
        value: s,
        label: STATUS_LABELS[s] ?? s,
        count: products.filter((p) => p.moderationStatus === s).length,
      })).filter((o) => o.count > 0),
    },
    {
      id: "flags",
      label: "Flags",
      type: "multi",
      options: [
        { value: "featured",  label: "Featured",  count: products.filter((p) => p.isFeatured).length },
        { value: "collector", label: "Collector", count: products.filter((p) => p.isCollectorPiece).length },
        { value: "privilege", label: "Privilege", count: products.filter((p) => p.isPrivilegeAssist).length },
        { value: "promotion", label: "Promotion", count: products.filter((p) => p.isPromotion).length },
      ].filter((o) => o.count > 0),
    },
    { id: "createdAt", label: "Created", type: "daterange" },
    { id: "priceUSD", label: "USD Price", type: "numrange" as const },
    { id: "priceMMK", label: "MMK Price", type: "numrange" as const },
  ]

  const groupOptions: GroupOption[] = [
    { id: "type",       label: "Type" },
    { id: "category",   label: "Category" },
    { id: "status",     label: "Status" },
    { id: "moderation", label: "Moderation" },
    { id: "seller",     label: "Seller" },
    { id: "visibility", label: "Visibility" },
  ]

  return (
    <ListViewCard
      rows={products}
      columnDefs={columnDefs}
      views={views}
      activeView={activeView}
      buildViewHref={(v) => buildViewHref(v, currentSearch)}
      filterDefs={filterDefs}
      groupOptions={groupOptions}
      defaultFilters={{
        ...(isArchiveView ? { status: ["archive"] } : {}),
        ...defaultPriceFilters,
      }}
      onFilterChange={(filterId, values) => {
        if (filterId === "status") {
          if (values.includes("archive")) {
            router.push(`${BASE}?status=archive`)
            return true
          }
          if (isArchiveView) {
            router.push(BASE)
            return true
          }
        }
        if (filterId === "priceUSD" || filterId === "priceMMK") {
          const params = new URLSearchParams(searchParams.toString())
          const minKey = filterId === "priceUSD" ? "priceMinUSD" : "priceMinMMK"
          const maxKey = filterId === "priceUSD" ? "priceMaxUSD" : "priceMaxMMK"
          const min = values.find((v) => v.startsWith("min:"))?.substring(4)
          const max = values.find((v) => v.startsWith("max:"))?.substring(4)
          if (min) params.set(minKey, min); else params.delete(minKey)
          if (max) params.set(maxKey, max); else params.delete(maxKey)
          params.set("page", "1")
          router.push(`${BASE}?${params.toString()}`)
          return true
        }
      }}
      getGroupKey={(r, grp) => {
        switch (grp) {
          case "type":       return r.productType === "loose_stone" ? "Loose Stone" : "Jewellery"
          case "category":   return r.categoryName ?? "Uncategorized"
          case "status":     return STATUS_LABELS[r.status] ?? r.status
          case "moderation": return STATUS_LABELS[r.moderationStatus] ?? r.moderationStatus
          case "seller":     return r.sellerName
          case "visibility": {
            const parts: string[] = []
            if (r.isFeatured)       parts.push("Featured Listing")
            if (r.isCollectorPiece) parts.push("Collector Piece")
            if (r.isPrivilegeAssist) parts.push("Privilege Assist")
            return parts.length ? parts.join(" · ") : "Standard"
          }
          default:           return null
        }
      }}
      filterRow={(r, filterId, vals) => {
        switch (filterId) {
          case "type":       return vals.includes(r.productType)
          case "category":   return vals.includes(r.categoryId ?? "")
          case "status":     return vals.includes(r.status)
          case "moderation": return vals.includes(r.moderationStatus)
          case "flags":
            return vals.every((f) =>
              (f === "featured"  && r.isFeatured)       ||
              (f === "collector" && r.isCollectorPiece) ||
              (f === "privilege" && r.isPrivilegeAssist)||
              (f === "promotion" && r.isPromotion)
            )
          case "createdAt": {
            const from = vals.find((v) => v.startsWith("from:"))?.substring(5)
            const to   = vals.find((v) => v.startsWith("to:"))?.substring(3)
            const d = new Date(r.createdAt)
            if (from && d < new Date(from + "T00:00:00")) return false
            if (to   && d > new Date(to   + "T23:59:59")) return false
            return true
          }
          case "priceUSD": {
            if (r.currency !== "USD") return false
            const min = vals.find((v) => v.startsWith("min:"))?.substring(4)
            const max = vals.find((v) => v.startsWith("max:"))?.substring(4)
            const p = Number(r.price)
            if (min && p < Number(min)) return false
            if (max && p > Number(max)) return false
            return true
          }
          case "priceMMK": {
            if (r.currency !== "MMK") return false
            const min = vals.find((v) => v.startsWith("min:"))?.substring(4)
            const max = vals.find((v) => v.startsWith("max:"))?.substring(4)
            const p = Number(r.price)
            if (min && p < Number(min)) return false
            if (max && p > Number(max)) return false
            return true
          }
          default: return null
        }
      }}
      defaultSort={{ id: "createdAt", dir: "desc" }}
      getSortValue={(r, colId) => {
        switch (colId) {
          case "product":    return r.title.toLowerCase()
          case "type":       return r.categoryName ?? ""
          case "price":      return Number(r.price)
          case "status":     return r.status
          case "moderation": return r.moderationStatus
          case "seller":     return r.sellerName
          case "createdAt":  return r.createdAt.getTime()
          default:           return ""
        }
      }}
      onRowClick={(r) => router.push(`/admin/products/${r.id}/edit`)}
      renderBulkActions={(rows, onClear) => {
        const ids = rows.map((r) => r.id)
        return (
          <>
            <button
              className="lv-bulkbtn"
              disabled={isPending}
              onClick={() => runBulk("approve", () => bulkSetProductModeration(ids, "approved"), onClear, ids.length)}
            >
              <Check /> {pendingAction === "approve" ? "Approving…" : "Approve"}
            </button>
            <button
              className="lv-bulkbtn"
              disabled={isPending}
              onClick={() => runBulk("reject", () => bulkSetProductModeration(ids, "rejected"), onClear, ids.length)}
            >
              <X /> {pendingAction === "reject" ? "Rejecting…" : "Reject"}
            </button>
            <button
              className="lv-bulkbtn"
              disabled={isPending}
              onClick={() => runBulk("archive", () => bulkSetProductStatus(ids, "archive"), onClear, ids.length)}
            >
              <Archive /> {pendingAction === "archive" ? "Archiving…" : "Archive"}
            </button>
          </>
        )
      }}
      page={page}
      pageSize={pageSize}
      total={total}
      defaultSearch={currentSearch}
      onSearch={handleSearch}
      buildPageHref={(p) => buildPageHref(p, activeView, currentSearch)}
      emptyMessage="No products found. Try adjusting the filters or view."
    />
  )
}
