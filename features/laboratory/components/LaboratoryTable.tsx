"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { LaboratoryOption } from "@/features/laboratory/db/laboratory"
import { deleteLaboratoryAction } from "@/features/laboratory/actions/laboratory"
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

type Props = { laboratories: LaboratoryOption[] }

export function LaboratoryTable({ laboratories }: Props) {
  const router = useRouter()
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  return (
    <>
      <AdminTableShell>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              <th className={adminTH}>Name</th>
              <th className={adminTH}>Address</th>
              <th className={adminTH + " w-40"}>Phone</th>
              <th className={adminTH}>Precaution</th>
              <th className={adminTHRight + " w-24"}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {laboratories.length === 0 ? (
              <AdminEmptyRow colSpan={5} message="No laboratories yet. Add one to get started." />
            ) : (
              laboratories.map((lab) => (
                <tr
                  key={lab.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`/admin/laboratory/${lab.id}/edit`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      router.push(`/admin/laboratory/${lab.id}/edit`)
                    }
                  }}
                  className={adminTRClickable}
                >
                  <td className={adminTD}>
                    <span className="font-medium text-slate-800">{lab.name}</span>
                  </td>
                  <td
                    className="max-w-[180px] truncate px-4 py-3 text-xs text-slate-500"
                    title={lab.address}
                  >
                    {lab.address}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{lab.phone}</td>
                  <td
                    className="max-w-[180px] truncate px-4 py-3 text-xs text-slate-500"
                    title={lab.precaution ?? ""}
                  >
                    {lab.precaution || "—"}
                  </td>
                  <td
                    className="px-4 py-3 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="inline-flex items-center gap-0.5">
                      <Link
                        href={`/admin/laboratory/${lab.id}/edit`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                        aria-label="Edit"
                      >
                        <Pencil className="size-3.5" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ id: lab.id, name: lab.name })}
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
        title="Delete laboratory"
        description={<>Delete <strong>{deleteTarget?.name}</strong>? Products referencing this lab will have their lab cleared.</>}
        onDelete={async () => {
          if (!deleteTarget) return
          const form = new FormData()
          form.set("laboratoryId", deleteTarget.id)
          const result = await deleteLaboratoryAction(form)
          if (result?.error) return result.error
          router.refresh()
          setDeleteTarget(null)
        }}
      />
    </>
  )
}
