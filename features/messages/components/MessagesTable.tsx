"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Pencil } from "lucide-react"
import type { MessageRow } from "@/features/messages/db/messages"
import { deleteMessageAction } from "@/features/messages/actions/messages"
import { formatDate } from "@/lib/formatters"
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

type Props = { messages: MessageRow[] }

export function MessagesTable({ messages }: Props) {
  const router = useRouter()
  const [deleteTarget, setDeleteTarget] = useState<{ id: string } | null>(null)

  return (
    <>
      <AdminTableShell>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              <th className={adminTH}>Sender</th>
              <th className={adminTH}>Recipient</th>
              <th className={adminTH + " w-28"}>Type</th>
              <th className={adminTH + " w-20"}>Read</th>
              <th className={adminTH + " w-44"}>Created</th>
              <th className={adminTHRight + " w-24"}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {messages.length === 0 ? (
              <AdminEmptyRow colSpan={6} message="No messages yet." />
            ) : (
              messages.map((m) => (
                <tr
                  key={m.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`/admin/messages/${m.id}/edit`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      router.push(`/admin/messages/${m.id}/edit`)
                    }
                  }}
                  className={adminTRClickable}
                >
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{m.senderId}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{m.recipientId}</td>
                  <td className={adminTD}>
                    <AdminStatusBadge
                      status={m.messageType}
                      label={m.messageType}
                    />
                  </td>
                  <td className={adminTD}>
                    <span className={`text-xs font-medium ${m.isRead ? "text-emerald-600" : "text-slate-400"}`}>
                      {m.isRead ? "Read" : "Unread"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {formatDate(new Date(m.createdAt))}
                  </td>
                  <td
                    className="px-4 py-3 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="inline-flex items-center gap-0.5">
                      <Link
                        href={`/admin/messages/${m.id}/edit`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                        aria-label="Edit"
                      >
                        <Pencil className="size-3.5" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ id: m.id })}
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
        title="Delete message"
        description="Delete this message? This cannot be undone."
        onDelete={async () => {
          if (!deleteTarget) return
          const form = new FormData()
          form.set("id", deleteTarget.id)
          const result = await deleteMessageAction(form)
          if (result?.error) return result.error
          router.refresh()
          setDeleteTarget(null)
        }}
      />
    </>
  )
}
