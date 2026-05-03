"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { NewsRow } from "@/features/news/db/news"
import { deleteNewsAction } from "@/features/news/actions/news"
import { Pencil } from "lucide-react"
import { formatDate } from "@/lib/formatters"
import {
  AdminTableShell,
  AdminPagination,
  AdminStatusBadge,
  AdminDeleteDialog,
  AdminEmptyRow,
  adminTH,
  adminTHRight,
  adminTRClickable,
  adminTD,
} from "@/components/admin/admin-ui"

type Props = {
  news: NewsRow[]
  page: number
  totalPages: number
  total: number
}

export function NewsTable({ news: items, page, totalPages, total }: Props) {
  const router = useRouter()
  const base = "/admin/news"
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)

  function buildHref(p: number) {
    const sp = new URLSearchParams()
    sp.set("page", String(p))
    return `${base}?${sp.toString()}`
  }

  return (
    <>
      <AdminTableShell>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              <th className={adminTH}>Title</th>
              <th className={adminTH + " w-28"}>Status</th>
              <th className={adminTH + " w-44"}>Publish date</th>
              <th className={adminTHRight + " w-24"}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <AdminEmptyRow colSpan={4} message="No news yet. Create one to get started." />
            ) : (
              items.map((row) => (
                <tr
                  key={row.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`${base}/${row.id}/edit`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      router.push(`${base}/${row.id}/edit`)
                    }
                  }}
                  className={adminTRClickable}
                >
                  <td className={adminTD}>
                    <span className="font-medium text-slate-800">{row.title}</span>
                  </td>
                  <td className={adminTD}>
                    <AdminStatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {row.publish ? formatDate(new Date(row.publish)) : "—"}
                  </td>
                  <td
                    className="px-4 py-3 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="inline-flex items-center gap-0.5">
                      <Link
                        href={`${base}/${row.id}/edit`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                        aria-label="Edit"
                      >
                        <Pencil className="size-3.5" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ id: row.id, title: row.title })}
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

        <AdminPagination
          page={page}
          totalPages={totalPages}
          total={total}
          pageCount={items.length}
          buildHref={buildHref}
        />
      </AdminTableShell>

      <AdminDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Delete news"
        description={<>Delete <strong>&ldquo;{deleteTarget?.title}&rdquo;</strong>? This cannot be undone.</>}
        onDelete={async () => {
          if (!deleteTarget) return
          const form = new FormData()
          form.set("newsId", deleteTarget.id)
          const result = await deleteNewsAction(form)
          if (result?.error) return result.error
          router.refresh()
          setDeleteTarget(null)
        }}
      />
    </>
  )
}
