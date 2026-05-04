"use client"

import { useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check } from "lucide-react"
import type { CollectorPieceShowRequestRow } from "@/features/collector-piece-show-requests/db/collector-piece-show-requests"
import { approveCollectorPieceShowRequestAction } from "@/features/collector-piece-show-requests/actions/collector-piece-show-requests"
import { formatDate } from "@/lib/formatters"
import {
  AdminTableShell,
  AdminStatusBadge,
  AdminEmptyRow,
  adminTH,
  adminTHRight,
  adminTRClickable,
  adminTD,
} from "@/components/admin/admin-ui"

type Props = { requests: CollectorPieceShowRequestRow[] }

export function CollectorPieceShowRequestsTable({ requests }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function approve(requestId: string) {
    const form = new FormData()
    form.set("requestId", requestId)
    startTransition(async () => {
      const result = await approveCollectorPieceShowRequestAction(form)
      if (result?.error) {
        alert(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <AdminTableShell>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/80">
            <th className={adminTH}>Product</th>
            <th className={adminTH}>Requester</th>
            <th className={adminTH}>Message</th>
            <th className={adminTH + " w-28"}>Status</th>
            <th className={adminTH + " w-36"}>Created</th>
            <th className={adminTHRight + " w-28"}>Action</th>
          </tr>
        </thead>
        <tbody>
          {requests.length === 0 ? (
            <AdminEmptyRow colSpan={6} message="No collector piece requests." />
          ) : (
            requests.map((r) => (
              <tr key={r.id} className={adminTRClickable + " align-top"}>
                {/* Product */}
                <td className={adminTD}>
                  <Link
                    href={`/admin/products/${r.productId}/edit`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-medium text-primary hover:underline underline-offset-2"
                  >
                    {r.product.title}
                  </Link>
                  <div className="mt-0.5">
                    <AdminStatusBadge status={r.product.status} label={r.product.status} />
                  </div>
                </td>

                {/* Requester */}
                <td className={adminTD}>
                  <Link
                    href={`/admin/users/${r.userId}/edit`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-medium text-primary hover:underline underline-offset-2"
                  >
                    {r.requester.name}
                  </Link>
                  <div className="mt-0.5 text-xs text-slate-500">{r.requester.email}</div>
                  {r.requester.phone && (
                    <div className="text-xs text-slate-400">{r.requester.phone}</div>
                  )}
                </td>

                {/* Message */}
                <td className="max-w-[200px] px-4 py-3 text-xs text-slate-500">
                  {r.message ?? <span className="text-slate-300">—</span>}
                </td>

                {/* Status */}
                <td className={adminTD}>
                  <AdminStatusBadge status={r.status} />
                </td>

                {/* Created */}
                <td className="px-4 py-3 text-xs text-slate-500">
                  {formatDate(r.createdAt)}
                </td>

                {/* Action */}
                <td
                  className="px-4 py-3 text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  {r.status === "pending" ? (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => approve(r.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200/60 transition-colors hover:bg-emerald-100 disabled:opacity-50"
                    >
                      <Check className="size-3.5" />
                      Approve
                    </button>
                  ) : (
                    <AdminStatusBadge status={r.status} />
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </AdminTableShell>
  )
}
