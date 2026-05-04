"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { ArticleRow } from "@/features/articles/db/articles"
import { deleteArticleAction } from "@/features/articles/actions/articles"
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
  articles: ArticleRow[]
  page: number
  totalPages: number
  total: number
}

export function ArticlesTable({ articles: items, page, totalPages, total }: Props) {
  const router = useRouter()
  const base = "/admin/articles"
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
              <th className={adminTH + " w-36"}>Author</th>
              <th className={adminTH + " w-28"}>Status</th>
              <th className={adminTH + " w-44"}>Publish date</th>
              <th className={adminTHRight + " w-24"}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <AdminEmptyRow colSpan={5} message="No articles yet. Create one to get started." />
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
                  <td className="px-4 py-3 text-xs text-slate-500">{row.author || "—"}</td>
                  <td className={adminTD}>
                    <AdminStatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {row.publishDate ? formatDate(new Date(row.publishDate)) : "—"}
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
        title="Delete article"
        description={<>Delete <strong>&ldquo;{deleteTarget?.title}&rdquo;</strong>? This cannot be undone.</>}
        onDelete={async () => {
          if (!deleteTarget) return
          const form = new FormData()
          form.set("articleId", deleteTarget.id)
          const result = await deleteArticleAction(form)
          if (result?.error) return result.error
          router.refresh()
          setDeleteTarget(null)
        }}
      />
    </>
  )
}
