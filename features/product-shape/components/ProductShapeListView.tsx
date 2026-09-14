"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import { ListViewCard, fmtDate, fmtRelative, buildListViewHrefs } from "@/components/admin/list-view"
import type { ColumnDef, ViewTab } from "@/components/admin/list-view"
import { AdminDeleteDialog } from "@/components/admin/admin-ui"
import { deleteProductShapeAction } from "@/features/product-shape/actions/product-shape"
import type { ProductShapeOption } from "@/features/product-shape/db/product-shape"

function shapeHue(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 47 + s.charCodeAt(i)) & 0xffff
  return (h % 200) + 160
}

function ShapeAvatar({ shape }: { shape: ProductShapeOption }) {
  const hue = shapeHue(shape.name)
  const initials =
    shape.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "SH"
  return (
    <span className="ori-avatar" style={{ "--hue": hue } as React.CSSProperties}>
      <span className="ori-avatar-glyph">{initials}</span>
    </span>
  )
}

type Props = {
  shapes: ProductShapeOption[]
  views: ViewTab[]
  activeView: string
}

const { buildViewHref, buildPageHref } = buildListViewHrefs("/admin/product-shape")

export function ProductShapeListView({ shapes, views, activeView }: Props) {
  const router = useRouter()
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  const columnDefs: ColumnDef<ProductShapeOption>[] = [
    {
      id: "name",
      label: "Product Shape",
      flex: true,
      sortable: true,
      render: (r) => (
        <div className="ori-cell">
          <ShapeAvatar shape={r} />
          <div className="ori-cell-meta">
            <span className="ori-cell-name">{r.name}</span>
          </div>
        </div>
      ),
    },
    {
      id: "updatedAt",
      label: "Updated",
      width: 150,
      sortable: true,
      render: (r) => (
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
          <span
            style={{
              fontSize: 12.5,
              color: "var(--lv-text)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {fmtDate(r.updatedAt)}
          </span>
          <span style={{ fontSize: 10.5, color: "var(--lv-text-3)" }}>
            {fmtRelative(r.updatedAt)}
          </span>
        </div>
      ),
    },
    {
      id: "actions",
      label: "Actions",
      width: 100,
      align: "right",
      sortable: false,
      toggleable: false,
      render: (r) => (
        <button
          type="button"
          className="lv-rowbtn lv-icon lv-danger"
          onClick={(e) => {
            e.stopPropagation()
            setDeleteTarget({ id: r.id, name: r.name })
          }}
          aria-label={`Delete ${r.name}`}
        >
          <Trash2 />
        </button>
      ),
    },
  ]

  return (
    <>
      <ListViewCard
        rows={shapes}
        columnDefs={columnDefs}
        views={views}
        activeView={activeView}
        buildViewHref={buildViewHref}
        defaultSort={{ id: "name", dir: "asc" }}
        getSortValue={(r, colId) => {
          switch (colId) {
            case "name":
              return r.name.toLowerCase()
            case "updatedAt":
              return r.updatedAt.getTime()
            default:
              return ""
          }
        }}
        onRowClick={(r) => router.push(`/admin/product-shape/${r.id}/edit`)}
        buildPageHref={(pg) => buildPageHref(pg, activeView)}
        emptyMessage="No product shapes yet. Add one to get started."
        onRefresh={() => router.refresh()}
      />

      <AdminDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Delete product shape"
        description={
          <>
            Delete <strong>&ldquo;{deleteTarget?.name}&rdquo;</strong>? This cannot be undone.
            Existing products keep their stored shape text.
          </>
        }
        onDelete={async () => {
          if (!deleteTarget) return
          const form = new FormData()
          form.set("productShapeId", deleteTarget.id)
          const result = await deleteProductShapeAction(form)
          if (result?.error) return result.error
          toast.success("Product shape deleted")
          router.refresh()
          setDeleteTarget(null)
        }}
      />
    </>
  )
}
