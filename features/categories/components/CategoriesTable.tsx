"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { CategoryRow } from "@/features/categories/db/categories"
import { deleteCategoryAction } from "@/features/categories/actions/categories"
import { Pencil } from "lucide-react"
import {
  AdminTableShell,
  AdminStatusBadge,
  AdminDeleteDialog,
  AdminEmptyRow,
  adminTH,
  adminTHRight,
  adminTRClickable,
  adminTD,
} from "@/components/admin/admin-ui"

type Props = { categories: CategoryRow[] }

export function CategoriesTable({ categories }: Props) {
  const router = useRouter()
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  const loose = categories.filter((c) => c.type === "loose_stone")
  const jewellery = categories.filter((c) => c.type === "jewellery")
  const sorted = [...loose, ...jewellery]

  return (
    <>
      <AdminTableShell>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              <th className={adminTH}>Name</th>
              <th className={adminTH + " w-16"}>Image</th>
              <th className={adminTH}>Short Code</th>
              <th className={adminTH}>Type</th>
              <th className={adminTH + " w-24"}>Order</th>
              <th className={adminTHRight + " w-24"}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <AdminEmptyRow colSpan={6} message="No categories yet. Add one to use in products." />
            ) : (
              sorted.map((c) => (
                <tr
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`/admin/categories/${c.id}/edit`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      router.push(`/admin/categories/${c.id}/edit`)
                    }
                  }}
                  className={adminTRClickable}
                >
                  <td className={adminTD}>
                    <span className="font-medium text-slate-800">{c.name}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="relative h-9 w-9 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200/60">
                      {c.image ? (
                        <Image
                          src={c.image}
                          alt=""
                          fill
                          className="object-cover"
                          unoptimized={c.image.startsWith("blob:") || c.image.startsWith("data:")}
                          sizes="36px"
                        />
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-slate-500">{c.shortCode ?? "—"}</span>
                  </td>
                  <td className={adminTD}>
                    <AdminStatusBadge
                      status={c.type === "loose_stone" ? "featured" : "buyer"}
                      label={c.type === "loose_stone" ? "Loose stone" : "Jewellery"}
                    />
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-600">{c.sortOrder}</td>
                  <td
                    className="px-4 py-3 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="inline-flex items-center gap-0.5">
                      <Link
                        href={`/admin/categories/${c.id}/edit`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                        aria-label="Edit"
                      >
                        <Pencil className="size-3.5" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ id: c.id, name: c.name })}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        aria-label="Delete"
                      >
                        <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </AdminTableShell>

      <AdminDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Delete category"
        description={
          <>
            Delete <strong>{deleteTarget?.name}</strong>? Products using this
            category will have their category cleared.
          </>
        }
        onDelete={async () => {
          if (!deleteTarget) return
          const form = new FormData()
          form.set("id", deleteTarget.id)
          const result = await deleteCategoryAction(form)
          if (result?.error) return result.error
          router.refresh()
          setDeleteTarget(null)
        }}
      />
    </>
  )
}
