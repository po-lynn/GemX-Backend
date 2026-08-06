"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ListViewCard } from "@/components/admin/list-view"
import type { ColumnDef, ViewTab } from "@/components/admin/list-view"
import type { ReputationCase } from "@/features/reviews/db/reputation-cases"
import { ReputationCaseDrawer } from "./ReputationCaseDrawer"
import {
  archiveSellerAction,
  dismissCaseAction,
  recordSecondaryActionAction,
  bulkArchiveSellersAction,
  bulkDismissCasesAction,
} from "@/features/reviews/actions/reputation-cases"

function fmtDuration(d: Date): string {
  const diff = (Date.now() - new Date(d).getTime()) / 1000
  const days = Math.floor(diff / 86400)
  if (days >= 1) return `${days} day${days !== 1 ? "s" : ""}`
  const hours = Math.max(1, Math.floor(diff / 3600))
  return `${hours}h`
}

function buildViewHref(view: string): string {
  const p = new URLSearchParams()
  if (view !== "all") p.set("tab", view)
  p.set("page", "1")
  return `/admin/reviews/cases?${p.toString()}`
}

function buildPageHref(page: number, tab: string): string {
  const p = new URLSearchParams()
  p.set("page", String(page))
  if (tab !== "all") p.set("tab", tab)
  return `/admin/reviews/cases?${p.toString()}`
}

type Props = {
  cases: ReputationCase[]
  views?: ViewTab[]
  activeTab: string
  page: number
  pageSize: number
  total: number
}

export function ReputationCasesTable({ cases, views, activeTab, page, pageSize, total }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [archiveTarget, setArchiveTarget] = useState<ReputationCase | null>(null)
  const [archiveReason, setArchiveReason] = useState("")
  const [archiving, setArchiving] = useState(false)

  const [bulkReason, setBulkReason] = useState("")
  const [bulkMode, setBulkMode] = useState<"archive" | "dismiss" | null>(null)
  const [bulkTargets, setBulkTargets] = useState<ReputationCase[]>([])
  const [bulkBusy, setBulkBusy] = useState(false)

  const [drawerBusy, setDrawerBusy] = useState(false)

  // Returns whether the mutation succeeded, so callers (the row dialog's
  // confirmArchiveDialog and the drawer's handleDrawerArchive) can decide
  // whether to close their UI — on failure the toast carries the error and
  // the caller should stay open so the admin can see it and retry.
  async function handleArchive(sellerUserId: string, reason: string): Promise<boolean> {
    const form = new FormData()
    form.set("sellerUserId", sellerUserId)
    form.set("reason", reason)
    const result = await archiveSellerAction(form)
    if ("error" in result) {
      toast.error("Archive failed", { description: result.error })
      return false
    }
    toast.success("Seller archived", { description: "The profile and its listings are now hidden from buyers." })
    startTransition(() => router.refresh())
    return true
  }

  async function handleDismiss(sellerUserId: string, triggerKey: string, reason: string): Promise<boolean> {
    const form = new FormData()
    form.set("sellerUserId", sellerUserId)
    form.set("triggerKey", triggerKey)
    form.set("reason", reason)
    const result = await dismissCaseAction(form)
    if ("error" in result) {
      toast.error("Dismiss failed", { description: result.error })
      return false
    }
    toast.success("Case dismissed")
    startTransition(() => router.refresh())
    return true
  }

  async function handleSecondaryAction(sellerUserId: string, actionType: string): Promise<boolean> {
    const form = new FormData()
    form.set("sellerUserId", sellerUserId)
    form.set("actionType", actionType)
    const result = await recordSecondaryActionAction(form)
    if ("error" in result) {
      toast.error("Action failed", { description: result.error })
      return false
    }
    toast.success("Recorded")
    startTransition(() => router.refresh())
    return true
  }

  // Drawer variants of archive/dismiss/secondary-action: unlike the row-level
  // dialogs above, the drawer has no separate "confirm" step of its own — its
  // buttons ARE the confirm action. So the await-then-close pattern lives here
  // instead: track a real busy flag (drives ReputationCaseDrawer's `isBusy`,
  // which disables its textarea/buttons) and only close the drawer once the
  // mutation has resolved. On failure, `onClose` is never called, so the
  // drawer stays open and the error toast is visible against it.
  async function handleDrawerArchive(sellerUserId: string, reason: string, onClose: () => void) {
    setDrawerBusy(true)
    try {
      const ok = await handleArchive(sellerUserId, reason)
      if (ok) onClose()
    } finally {
      setDrawerBusy(false)
    }
  }

  async function handleDrawerDismiss(
    sellerUserId: string,
    triggerKey: string,
    reason: string,
    onClose: () => void
  ) {
    setDrawerBusy(true)
    try {
      const ok = await handleDismiss(sellerUserId, triggerKey, reason)
      if (ok) onClose()
    } finally {
      setDrawerBusy(false)
    }
  }

  // Secondary actions don't close the drawer (the admin may fire several in a
  // row), but still track busy so the drawer disables its controls while the
  // request is in flight instead of allowing overlapping submissions.
  async function handleDrawerSecondaryAction(sellerUserId: string, actionType: string) {
    setDrawerBusy(true)
    try {
      await handleSecondaryAction(sellerUserId, actionType)
    } finally {
      setDrawerBusy(false)
    }
  }

  function openArchiveDialog(row: ReputationCase) {
    setArchiveTarget(row)
    setArchiveReason("")
  }

  async function confirmArchiveDialog() {
    if (!archiveTarget) return
    setArchiving(true)
    try {
      const ok = await handleArchive(archiveTarget.sellerUserId, archiveReason.trim())
      if (ok) setArchiveTarget(null)
    } finally {
      setArchiving(false)
    }
  }

  function openBulk(mode: "archive" | "dismiss", rows: ReputationCase[]) {
    setBulkMode(mode)
    setBulkTargets(rows)
    setBulkReason("")
  }

  async function confirmBulk() {
    if (!bulkMode || bulkTargets.length === 0) return
    setBulkBusy(true)
    try {
      const result =
        bulkMode === "archive"
          ? await bulkArchiveSellersAction(bulkTargets.map((r) => r.sellerUserId), bulkReason.trim())
          : await bulkDismissCasesAction(
              bulkTargets
                .filter((r) => r.signals[0])
                .map((r) => ({ sellerUserId: r.sellerUserId, triggerKey: r.signals[0].triggerKey })),
              bulkReason.trim()
            )
      if ("error" in result) {
        toast.error("Bulk action failed", { description: result.error })
        return
      }
      toast.success(`${bulkTargets.length} case${bulkTargets.length !== 1 ? "s" : ""} updated`)
      setBulkMode(null)
      startTransition(() => router.refresh())
    } finally {
      setBulkBusy(false)
    }
  }

  const columnDefs: ColumnDef<ReputationCase>[] = [
    {
      id: "seller",
      label: "Seller & why it was flagged",
      flex: true,
      sortable: true,
      render: (r) => (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="lv-avatar">{r.sellerName.slice(0, 2).toUpperCase()}</span>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{r.sellerName}</span>
            <span style={{ fontSize: 11.5, color: "var(--lv-text-4, #a1a1aa)" }}>{r.sellerUserId}</span>
          </div>
          <div style={{ fontSize: 13.5, color: "#52525B", marginTop: 4, maxWidth: 520 }}>
            {r.signals[0]?.detail ?? ""}
          </div>
        </div>
      ),
    },
    {
      id: "rating",
      label: "Rating",
      width: 130,
      sortable: true,
      render: (r) => (
        <div>
          <span style={{ fontWeight: 500 }}>{r.avgRating.toFixed(2)} ★</span>{" "}
          <span style={{ color: r.ratingChange30d >= 0 ? "#15803D" : "#B91C1C", fontSize: 12, fontWeight: 600 }}>
            {r.ratingChange30d >= 0 ? "+" : ""}
            {r.ratingChange30d.toFixed(2)}
          </span>
          <div style={{ fontSize: 12, color: "var(--lv-text-4, #a1a1aa)" }}>{r.reviewCount} reviews</div>
        </div>
      ),
    },
    {
      id: "negativeMix",
      label: "Negative mix",
      width: 124,
      sortable: true,
      render: (r) => <span style={{ fontSize: 12, color: "#B91C1C" }}>{r.negativeMixPct}% at 1–2★</span>,
    },
    {
      id: "severity",
      label: "Severity",
      width: 128,
      sortable: true,
      render: (r) => <span className={`lv-status ${r.severity}`}>{r.severity}</span>,
    },
    {
      id: "openFor",
      label: "Open for",
      width: 104,
      sortable: true,
      render: (r) => <span>{fmtDuration(r.openSince)}</span>,
    },
  ]

  return (
    <>
      <ListViewCard
        rows={cases}
        columnDefs={columnDefs}
        views={views}
        activeView={activeTab}
        buildViewHref={buildViewHref}
        defaultSort={{ id: "severity", dir: "desc" }}
        getSortValue={(r, colId) => {
          switch (colId) {
            case "seller": return r.sellerName
            case "rating": return r.avgRating
            case "negativeMix": return r.negativeMixPct
            case "severity": return { critical: 3, high: 2, medium: 1, watch: 0 }[r.severity]
            case "openFor": return r.openSince.getTime()
            default: return ""
          }
        }}
        rowActions={(r, disabled) => (
          <>
            <button className="lv-rowbtn reject" disabled={disabled} onClick={() => openArchiveDialog(r)}>
              Archive
            </button>
            <button
              className="lv-rowbtn"
              disabled={disabled || !r.signals[0]}
              onClick={() => r.signals[0] && handleDismiss(r.sellerUserId, r.signals[0].triggerKey, "Dismissed from row action")}
            >
              Dismiss
            </button>
          </>
        )}
        renderDrawer={(r, onClose) => (
          <ReputationCaseDrawer
            row={r}
            onClose={onClose}
            onArchive={(sellerUserId, reason) => { void handleDrawerArchive(sellerUserId, reason, onClose) }}
            onDismiss={(sellerUserId, triggerKey, reason) => { void handleDrawerDismiss(sellerUserId, triggerKey, reason, onClose) }}
            onSecondaryAction={(sellerUserId, actionType) => { void handleDrawerSecondaryAction(sellerUserId, actionType) }}
            isBusy={drawerBusy}
          />
        )}
        renderBulkActions={(selectedRows, onClear) => (
          <>
            <button className="lv-bulkbtn reject" onClick={() => openBulk("archive", selectedRows)}>
              Archive selected
            </button>
            <button className="lv-bulkbtn" onClick={() => openBulk("dismiss", selectedRows)}>
              Dismiss flags
            </button>
            <button className="lv-bulkbtn" onClick={onClear}>
              Clear
            </button>
          </>
        )}
        page={page}
        pageSize={pageSize}
        total={total}
        buildPageHref={(p) => buildPageHref(p, activeTab)}
        emptyMessage="No open cases right now."
      />

      <Dialog open={archiveTarget !== null} onOpenChange={(v) => { if (!archiving && !v) setArchiveTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-base">Archive {archiveTarget?.sellerName}</DialogTitle>
            <DialogDescription>
              This hides the seller&apos;s profile and listings from buyers. Reviews stay attached to the record.
            </DialogDescription>
          </DialogHeader>
          <textarea
            placeholder="Reason for the decision (stored in the audit log)…"
            value={archiveReason}
            onChange={(e) => setArchiveReason(e.target.value)}
            rows={3}
            disabled={archiving}
            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setArchiveTarget(null)} disabled={archiving}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={confirmArchiveDialog}
              disabled={archiving || !archiveReason.trim()}
            >
              {archiving ? "Archiving…" : "Confirm Archive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkMode !== null} onOpenChange={(v) => { if (!bulkBusy && !v) setBulkMode(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-base">
              {bulkMode === "archive" ? "Archive" : "Dismiss"} {bulkTargets.length} case{bulkTargets.length !== 1 ? "s" : ""}
            </DialogTitle>
            <DialogDescription>One shared reason is recorded against every selected seller.</DialogDescription>
          </DialogHeader>
          <textarea
            placeholder="Reason for the decision (stored in the audit log)…"
            value={bulkReason}
            onChange={(e) => setBulkReason(e.target.value)}
            rows={3}
            disabled={bulkBusy}
            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setBulkMode(null)} disabled={bulkBusy}>
              Cancel
            </Button>
            <Button
              variant={bulkMode === "archive" ? "destructive" : "default"}
              size="sm"
              onClick={confirmBulk}
              disabled={bulkBusy || !bulkReason.trim()}
            >
              {bulkBusy ? "Working…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
