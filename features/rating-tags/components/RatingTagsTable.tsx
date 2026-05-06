"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { RatingTagRow } from "@/features/rating-tags/db/rating-tags"
import { deleteRatingTagAction } from "@/features/rating-tags/actions/rating-tags"
import { Pencil } from "lucide-react"
import {
  AdminTableShell,
  AdminDeleteDialog,
  AdminEmptyRow,
  adminTH,
  adminTHRight,
  adminTRClickable,
  adminTD,
} from "@/components/admin/admin-ui"

type Props = { ratingTags: RatingTagRow[] }

export function RatingTagsTable({ ratingTags }: Props) {
  const router = useRouter()
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    name: string
  } | null>(null)

  return (
    <>
      <AdminTableShell>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              <th className={adminTH}>Name</th>
              <th className={adminTH}>Type</th>
              <th className={adminTH}>Visible</th>
              <th className={adminTHRight + " w-24"}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {ratingTags.length === 0 ? (
              <AdminEmptyRow
                colSpan={4}
                message="No rating tags yet. Create presets for seller feedback."
              />
            ) : (
              ratingTags.map((t) => (
                <tr
                  key={t.id}
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    router.push(`/admin/settings/rating-tags/${t.id}/edit`)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      router.push(`/admin/settings/rating-tags/${t.id}/edit`)
                    }
                  }}
                  className={adminTRClickable}
                >
                  <td className={adminTD}>
                    <span className="font-medium text-slate-800">{t.name}</span>
                  </td>
                  <td className="px-4 py-3 text-xs capitalize text-slate-600">
                    {t.type}
                  </td>
                  <td className={adminTD}>
                    {t.isActive ? (
                      <span className="text-xs font-medium text-emerald-700">
                        Yes
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Hidden</span>
                    )}
                  </td>
                  <td
                    className="px-4 py-3 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="inline-flex items-center gap-0.5">
                      <Link
                        href={`/admin/settings/rating-tags/${t.id}/edit`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                        aria-label="Edit"
                      >
                        <Pencil className="size-3.5" />
                      </Link>
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteTarget({ id: t.id, name: t.name })
                        }
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        aria-label="Delete"
                      >
                        <svg
                          className="size-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
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
        title="Delete rating tag"
        description={
          <>
            Delete <strong>{deleteTarget?.name}</strong>? This removes the tag
            definition from the system.
          </>
        }
        onDelete={async () => {
          if (!deleteTarget) return
          const form = new FormData()
          form.set("ratingTagId", deleteTarget.id)
          const result = await deleteRatingTagAction(form)
          if (result?.error) return result.error
          router.refresh()
          setDeleteTarget(null)
        }}
      />
    </>
  )
}
