"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { ListViewCard } from "@/components/admin/list-view"
import type { ColumnDef, ViewTab, FilterDef, GroupOption } from "@/components/admin/list-view"
import type { CategoryRow } from "@/features/categories/db/categories"

// ─── Helpers ──────────────────────────────────────────────

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function fmtRelative(d: Date): string {
  const diff = (Date.now() - new Date(d).getTime()) / 1000
  if (diff < 60)     return "just now"
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return fmtDate(d)
}

function gemHue(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 47 + s.charCodeAt(i)) & 0xffff
  return (h % 300) + 20
}

// ─── Sub-components ────────────────────────────────────────

function CatThumb({ cat }: { cat: CategoryRow }) {
  const hue = gemHue(cat.name)
  const initials = cat.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "GX"
  return (
    <span className="cat-thumb" style={{ "--hue": hue } as React.CSSProperties}>
      {cat.image ? (
        <Image
          src={cat.image}
          alt=""
          width={36}
          height={36}
          style={{ objectFit: "cover", width: "100%", height: "100%", position: "absolute", inset: 0 }}
        />
      ) : (
        <span className="cat-thumb-glyph">{initials}</span>
      )}
    </span>
  )
}

function TypePill({ type }: { type: "loose_stone" | "jewellery" }) {
  return (
    <span className="cat-typepill" data-type={type === "loose_stone" ? "loose" : "jewellery"}>
      <span className="cat-typepill-dot" />
      {type === "loose_stone" ? "Loose stone" : "Jewellery"}
    </span>
  )
}

// ─── Props / URL helpers ───────────────────────────────────

type Props = {
  categories: CategoryRow[]
  allCategories: CategoryRow[]
  views: ViewTab[]
  activeView: string
}

const BASE = "/admin/categories"

function buildViewHref(view: string): string {
  const p = new URLSearchParams()
  if (view !== "all") p.set("view", view)
  return p.toString() ? `${BASE}?${p}` : BASE
}

function buildPageHref(pg: number, view: string): string {
  const p = new URLSearchParams()
  if (view !== "all") p.set("view", view)
  p.set("page", String(pg))
  return `${BASE}?${p}`
}

// ─── Main component ────────────────────────────────────────

export function CategoriesListView({ categories, allCategories, views, activeView }: Props) {
  const router = useRouter()

  const columnDefs: ColumnDef<CategoryRow>[] = [
    {
      id: "category",
      label: "Category",
      flex: true,
      sortable: true,
      render: (r) => (
        <div className="cat-cell">
          <CatThumb cat={r} />
          <div className="cat-cell-meta">
            <span className="cat-cell-name">{r.name}</span>
            <span className="cat-cell-slug">
              <span className="cat-cell-slug-host">/categories/</span>
              {r.slug}
            </span>
          </div>
        </div>
      ),
    },
    {
      id: "code",
      label: "Short code",
      width: 130,
      sortable: true,
      render: (r) =>
        r.shortCode ? (
          <span className="cat-code">{r.shortCode}</span>
        ) : (
          <span style={{ color: "var(--lv-text-4)", fontSize: 12 }}>—</span>
        ),
    },
    {
      id: "type",
      label: "Type",
      width: 155,
      sortable: true,
      render: (r) => <TypePill type={r.type} />,
    },
    {
      id: "sortOrder",
      label: "Order",
      width: 80,
      sortable: true,
      align: "left",
      render: (r) => (
        <span className="cat-order">
          <svg className="cat-order-grip" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
            <circle cx="6" cy="4" r="1.2" /><circle cx="10" cy="4" r="1.2" />
            <circle cx="6" cy="8" r="1.2" /><circle cx="10" cy="8" r="1.2" />
            <circle cx="6" cy="12" r="1.2" /><circle cx="10" cy="12" r="1.2" />
          </svg>
          <span className="cat-order-num">{r.sortOrder}</span>
        </span>
      ),
    },
    {
      id: "updatedAt",
      label: "Updated",
      width: 150,
      sortable: true,
      render: (r) => (
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
          <span style={{ fontSize: 12.5, color: "var(--lv-text)", fontVariantNumeric: "tabular-nums" }}>
            {fmtDate(r.updatedAt)}
          </span>
          <span style={{ fontSize: 10.5, color: "var(--lv-text-3)" }}>
            {fmtRelative(r.updatedAt)}
          </span>
        </div>
      ),
    },
  ]

  // Filter counts always computed from all categories for accuracy across tabs
  const filterDefs: FilterDef[] = [
    {
      id: "type",
      label: "Type",
      type: "multi",
      options: [
        { value: "loose_stone", label: "Loose stone", count: allCategories.filter((c) => c.type === "loose_stone").length },
        { value: "jewellery",   label: "Jewellery",   count: allCategories.filter((c) => c.type === "jewellery").length },
      ],
    },
    {
      id: "imagery",
      label: "Imagery",
      type: "multi",
      options: [
        { value: "with",    label: "Has image",     count: allCategories.filter((c) => !!c.image).length },
        { value: "without", label: "Without image", count: allCategories.filter((c) => !c.image).length },
      ],
    },
  ]

  const groupOptions: GroupOption[] = [
    { id: "type", label: "Type" },
  ]

  return (
    <ListViewCard
      rows={categories}
      columnDefs={columnDefs}
      views={views}
      activeView={activeView}
      buildViewHref={buildViewHref}
      filterDefs={filterDefs}
      groupOptions={groupOptions}
      getGroupKey={(r, grp) => {
        if (grp === "type") return r.type === "loose_stone" ? "Loose stone" : "Jewellery"
        return null
      }}
      filterRow={(r, filterId, vals) => {
        if (filterId === "type") return vals.includes(r.type)
        if (filterId === "imagery") {
          const has = !!r.image
          return vals.some((v) => (v === "with" && has) || (v === "without" && !has))
        }
        return null
      }}
      defaultSort={{ id: "sortOrder", dir: "asc" }}
      getSortValue={(r, colId) => {
        switch (colId) {
          case "category":  return r.name.toLowerCase()
          case "code":      return r.shortCode ?? ""
          case "type":      return r.type
          case "sortOrder": return r.sortOrder
          case "updatedAt": return r.updatedAt.getTime()
          default:          return ""
        }
      }}
      onRowClick={(r) => router.push(`/admin/categories/${r.id}/edit`)}
      buildPageHref={(pg) => buildPageHref(pg, activeView)}
      emptyMessage="No categories found. Try adjusting the filters or add a new category."
    />
  )
}
