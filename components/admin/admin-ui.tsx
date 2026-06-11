"use client"

import { ReactNode, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ELLIPSIS_NEXT, ELLIPSIS_PREV, getPageNumbers } from "@/lib/pagination"
import { cn } from "@/lib/utils"

// ─── Status Badge ─────────────────────────────────────────────────────────────
const statusStyles: Record<string, string> = {
  active:    "bg-emerald-50  text-emerald-700 ring-emerald-200/60",
  published: "bg-emerald-50  text-emerald-700 ring-emerald-200/60",
  approved:  "bg-emerald-50  text-emerald-700 ring-emerald-200/60",
  deal_made: "bg-emerald-50  text-emerald-700 ring-emerald-200/60",
  contacted: "bg-sky-50      text-sky-700     ring-sky-200/60",
  pending:   "bg-amber-50    text-amber-700   ring-amber-200/60",
  draft:     "bg-slate-100   text-slate-600   ring-slate-200/60",
  archive:   "bg-slate-100   text-slate-600   ring-slate-200/60",
  sold:      "bg-slate-100   text-slate-600   ring-slate-200/60",
  hidden:    "bg-slate-100   text-slate-500   ring-slate-200/60",
  rejected:  "bg-red-50      text-red-700     ring-red-200/60",
  featured:  "bg-violet-50   text-violet-700  ring-violet-200/60",
  collector: "bg-amber-50    text-amber-700   ring-amber-200/60",
  promotion: "bg-orange-50   text-orange-700  ring-orange-200/60",
  privilege: "bg-indigo-50   text-indigo-700  ring-indigo-200/60",
  buyer:     "bg-blue-50     text-blue-700    ring-blue-200/60",
  seller:    "bg-purple-50   text-purple-700  ring-purple-200/60",
}

export function AdminStatusBadge({
  status,
  label,
  className,
}: {
  status: string
  label?: string
  className?: string
}) {
  const style =
    statusStyles[status.toLowerCase()] ??
    "bg-slate-100 text-slate-600 ring-slate-200/60"
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1",
        style,
        className
      )}
    >
      {label ?? status}
    </span>
  )
}

// ─── Table Shell ──────────────────────────────────────────────────────────────
export function AdminTableShell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200/60",
        className
      )}
    >
      <div className="overflow-x-auto">{children}</div>
    </div>
  )
}

// ─── Table class constants ────────────────────────────────────────────────────
export const adminTH =
  "h-11 px-4 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500 whitespace-nowrap"
export const adminTHRight =
  "h-11 px-4 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500 whitespace-nowrap"
export const adminTRClickable =
  "cursor-pointer border-b border-slate-100 text-sm last:border-0 transition-colors hover:bg-slate-50/80"
export const adminTD = "px-4 py-3 text-slate-700"

// ─── Pagination ───────────────────────────────────────────────────────────────
export function AdminPagination({
  page,
  totalPages,
  total,
  pageCount,
  buildHref,
}: {
  page: number
  totalPages: number
  total?: number
  pageCount?: number
  buildHref: (page: number) => string
}) {
  const safeTotalPages = Math.max(1, totalPages)
  const pageNumbers = getPageNumbers(page, safeTotalPages)
  if (safeTotalPages <= 1 && (total == null || total === 0)) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
      <p className="text-xs text-slate-500">
        Page {page} of {safeTotalPages}
        {total != null && (
          <span className="ml-1.5 text-slate-400">
            ·{pageCount != null ? ` ${pageCount} of` : ""}{" "}
            {total.toLocaleString()} total
          </span>
        )}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          className="h-8 px-3 text-xs"
          asChild={page > 1}
        >
          {page > 1 ? <Link href={buildHref(page - 1)}>← Prev</Link> : <span>← Prev</span>}
        </Button>

        {pageNumbers.map((n) =>
          n === ELLIPSIS_PREV || n === ELLIPSIS_NEXT ? (
            <span key={n} className="px-1 text-xs text-slate-400">
              …
            </span>
          ) : (
            <Button
              key={n}
              variant={n === page ? "default" : "ghost"}
              size="sm"
              className={cn(
                "h-8 min-w-8 px-2 text-xs",
                n === page && "pointer-events-none"
              )}
              asChild={n !== page}
            >
              {n === page ? <span>{n}</span> : <Link href={buildHref(n)}>{n}</Link>}
            </Button>
          )
        )}

        <Button
          variant="outline"
          size="sm"
          disabled={page >= safeTotalPages}
          className="h-8 px-3 text-xs"
          asChild={page < safeTotalPages}
        >
          {page < safeTotalPages ? (
            <Link href={buildHref(page + 1)}>Next →</Link>
          ) : (
            <span>Next →</span>
          )}
        </Button>
      </div>
    </div>
  )
}

// ─── Delete Dialog ─────────────────────────────────────────────────────────────
export function AdminDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  onDelete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  /** Return an error string on failure; undefined / void on success. */
  onDelete: () => Promise<string | undefined | void>
}) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handle() {
    setError(null)
    setDeleting(true)
    try {
      const err = await onDelete()
      if (err) {
        setError(err)
      } else {
        onOpenChange(false)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "An unexpected error occurred.")
    } finally {
      setDeleting(false)
    }
  }

  function safeOpenChange(v: boolean) {
    if (!deleting) {
      if (!v) setError(null)
      onOpenChange(v)
    }
  }

  return (
    <Dialog open={open} onOpenChange={safeOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200/60">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => safeOpenChange(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handle}
            disabled={deleting}
          >
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Empty State Row ──────────────────────────────────────────────────────────
export function AdminEmptyRow({
  colSpan,
  message = "No records found.",
}: {
  colSpan: number
  message?: string
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-16 text-center">
        <p className="text-sm text-slate-400">{message}</p>
      </td>
    </tr>
  )
}

// ─── Form utilities ──────────────────────────────────────────────────────────
export function AdminFormSection({
  title,
  description,
  children,
  className,
}: {
  title?: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200/60", className)}>
      {(title || description) && (
        <div className="border-b border-slate-100 px-5 py-4">
          {title && <h2 className="text-sm font-semibold text-slate-800">{title}</h2>}
          {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  )
}

export function AdminFormError({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200/60">
      {error}
    </p>
  )
}
