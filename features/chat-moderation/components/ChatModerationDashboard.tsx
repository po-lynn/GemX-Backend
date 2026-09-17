"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const inputClass =
  "h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-100"
const textareaClass = `${inputClass} h-20 resize-none`

type ReportRow = {
  id: string
  flatMessageId: string | null
  caseMessageId: string | null
  reporterId: string | null
  reporterName: string | null
  reason: string
  contentSnapshot: string
  status: "open" | "dismissed" | "actioned"
  resolvedAt: string | null
  resolutionAction: string | null
  resolutionReason: string | null
  createdAt: string
  senderId: string | null
  senderName: string | null
}

type RestrictionRow = {
  id: string
  userId: string
  userName: string | null
  restrictionType: "mute" | "ban"
  reason: string
  issuedByName: string | null
  startsAt: string
  expiresAt: string | null
  liftedAt: string | null
  liftReason: string | null
  createdAt: string
}

type AuditRow = {
  id: string
  actorId: string | null
  actorName: string | null
  actionType: string
  targetType: string
  targetId: string
  reason: string | null
  createdAt: string
}

type Tab = "reports" | "restrictions" | "audit"

const RESOLUTION_LABELS: Record<string, string> = {
  dismiss: "Dismissed",
  warn: "Warned",
  delete_message: "Message deleted",
  mute_user: "User muted",
  ban_user: "User banned",
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

/**
 * Chat oversight & moderation dashboard — reports queue, user messaging controls
 * (mute/ban/restore), and the audit trail viewer. One page with a lightweight local
 * tab switcher rather than three separate routes or the heavier ListViewTable
 * framework — this admin surface is low-traffic and doesn't need pagination/sorting
 * infrastructure built for e.g. the reputation cases table.
 */
export function ChatModerationDashboard() {
  const [tab, setTab] = useState<Tab>("reports")

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[17px] font-extrabold tracking-[-0.02em] text-[#17161c]">Chat Moderation</h1>
      </div>
      <div className="flex gap-1 border-b border-[#ececf3]">
        {(
          [
            { key: "reports", label: "Reports Queue" },
            { key: "restrictions", label: "Mutes & Bans" },
            { key: "audit", label: "Audit Trail" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-3.5 py-2 text-[13px] font-semibold ${
              tab === t.key
                ? "border-b-2 border-[#7c3aed] text-[#7c3aed]"
                : "border-b-2 border-transparent text-[#8b8a99] hover:text-[#3d3c49]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "reports" ? <ReportsQueue /> : tab === "restrictions" ? <RestrictionsPanel /> : <AuditTrailPanel />}
      </div>
    </div>
  )
}

function ReportsQueue() {
  const [status, setStatus] = useState<"open" | "dismissed" | "actioned">("open")
  const [reports, setReports] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [resolveTarget, setResolveTarget] = useState<ReportRow | null>(null)
  const [action, setAction] = useState<string>("dismiss")
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/chat-moderation/reports?status=${status}`, { credentials: "include" })
      const data = await res.json().catch(() => ({}))
      setReports((data as { reports?: ReportRow[] }).reports ?? [])
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    queueMicrotask(refresh)
  }, [refresh])

  function openResolve(report: ReportRow) {
    setResolveTarget(report)
    setAction("dismiss")
    setReason("")
  }

  async function handleResolve() {
    if (!resolveTarget) return
    if (!reason.trim()) {
      toast.error("A reason is required")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/chat-moderation/reports/${resolveTarget.id}/resolve`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: reason.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to resolve report")
      toast.success("Report resolved")
      setResolveTarget(null)
      await refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to resolve report")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1.5">
        {(["open", "dismissed", "actioned"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded-full px-3 py-1 text-[12px] font-semibold capitalize ${
              status === s ? "bg-[#7c3aed] text-white" : "bg-[#f4f3fb] text-[#5c5b6a]"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-[13px] text-[#8b8a99]">Loading…</p>
      ) : reports.length === 0 ? (
        <p className="text-[13px] text-[#8b8a99]">No {status} reports.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {reports.map((r) => (
            <div key={r.id} className="rounded-xl border border-[#ececf3] bg-white p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[12px] text-[#8b8a99]">
                    <Badge variant="outline">{r.flatMessageId ? "Chat" : "Escrow case"}</Badge>
                    <span>Reported by {r.reporterName ?? "Unknown"}</span>
                    <span>·</span>
                    <span>{formatDate(r.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-[13px] font-semibold text-[#17161c]">Reason: {r.reason}</p>
                  <p className="mt-1 line-clamp-2 text-[13px] text-[#3d3c49]">
                    From {r.senderName ?? "an unknown/deleted sender"}: “{r.contentSnapshot}”
                  </p>
                  {r.status !== "open" && (
                    <p className="mt-1 text-[12px] text-[#8b8a99]">
                      {RESOLUTION_LABELS[r.resolutionAction ?? ""] ?? r.resolutionAction} — {r.resolutionReason}
                    </p>
                  )}
                </div>
                {r.status === "open" && (
                  <Button size="sm" onClick={() => openResolve(r)}>
                    Resolve
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={resolveTarget !== null} onOpenChange={(v) => !submitting && !v && setResolveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve report</DialogTitle>
            <DialogDescription>Every action requires a reason, recorded on the audit trail.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <select className={inputClass} value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="dismiss">Dismiss</option>
              <option value="warn">Warn sender</option>
              <option value="delete_message">Delete message</option>
              <option value="mute_user">Mute sender (7 days)</option>
              <option value="ban_user">Ban sender</option>
            </select>
            <textarea
              className={textareaClass}
              placeholder="Reason (required, shown on the audit trail)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveTarget(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleResolve} disabled={submitting}>
              {submitting ? "Resolving…" : "Resolve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function RestrictionsPanel() {
  const [activeOnly, setActiveOnly] = useState(true)
  const [restrictions, setRestrictions] = useState<RestrictionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [issueOpen, setIssueOpen] = useState(false)
  const [liftTarget, setLiftTarget] = useState<RestrictionRow | null>(null)
  const [liftReason, setLiftReason] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({ userId: "", restrictionType: "mute" as "mute" | "ban", reason: "", durationHours: "168" })

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/chat-moderation/restrictions?activeOnly=${activeOnly}`, { credentials: "include" })
      const data = await res.json().catch(() => ({}))
      setRestrictions((data as { restrictions?: RestrictionRow[] }).restrictions ?? [])
    } finally {
      setLoading(false)
    }
  }, [activeOnly])

  useEffect(() => {
    queueMicrotask(refresh)
  }, [refresh])

  async function handleIssue() {
    if (!form.userId.trim() || !form.reason.trim()) {
      toast.error("User id and reason are required")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/admin/chat-moderation/restrictions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: form.userId.trim(),
          restrictionType: form.restrictionType,
          reason: form.reason.trim(),
          durationHours: form.restrictionType === "mute" ? Number(form.durationHours) || 168 : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to issue restriction")
      toast.success(`${form.restrictionType === "mute" ? "Mute" : "Ban"} issued`)
      setIssueOpen(false)
      setForm({ userId: "", restrictionType: "mute", reason: "", durationHours: "168" })
      await refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to issue restriction")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLift() {
    if (!liftTarget) return
    if (!liftReason.trim()) {
      toast.error("A reason is required")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/chat-moderation/restrictions/${liftTarget.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liftReason: liftReason.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to lift restriction")
      toast.success("Restriction lifted")
      setLiftTarget(null)
      setLiftReason("")
      await refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to lift restriction")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-[13px] text-[#5c5b6a]">
          <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
          Active only
        </label>
        <Button size="sm" onClick={() => setIssueOpen(true)}>
          Mute / Ban user
        </Button>
      </div>

      {loading ? (
        <p className="text-[13px] text-[#8b8a99]">Loading…</p>
      ) : restrictions.length === 0 ? (
        <p className="text-[13px] text-[#8b8a99]">No restrictions.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {restrictions.map((r) => (
            <div key={r.id} className="rounded-xl border border-[#ececf3] bg-white p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[13px] font-semibold text-[#17161c]">
                    <Badge variant={r.restrictionType === "ban" ? "destructive" : "secondary"}>
                      {r.restrictionType}
                    </Badge>
                    {r.userName ?? r.userId}
                  </div>
                  <p className="mt-1 text-[13px] text-[#3d3c49]">{r.reason}</p>
                  <p className="mt-1 text-[12px] text-[#8b8a99]">
                    Issued by {r.issuedByName ?? "Unknown"} on {formatDate(r.createdAt)}
                    {r.expiresAt ? ` · expires ${formatDate(r.expiresAt)}` : " · indefinite"}
                    {r.liftedAt ? ` · lifted ${formatDate(r.liftedAt)}: ${r.liftReason}` : ""}
                  </p>
                </div>
                {!r.liftedAt && (
                  <Button size="sm" variant="outline" onClick={() => setLiftTarget(r)}>
                    Restore
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={issueOpen} onOpenChange={(v) => !submitting && setIssueOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mute or ban a user</DialogTitle>
            <DialogDescription>A mute is a fixed duration; a ban is indefinite until restored.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <input
              className={inputClass}
              placeholder="User id"
              value={form.userId}
              onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
            />
            <select
              className={inputClass}
              value={form.restrictionType}
              onChange={(e) => setForm((f) => ({ ...f, restrictionType: e.target.value as "mute" | "ban" }))}
            >
              <option value="mute">Mute</option>
              <option value="ban">Ban</option>
            </select>
            {form.restrictionType === "mute" && (
              <input
                className={inputClass}
                type="number"
                placeholder="Duration (hours)"
                value={form.durationHours}
                onChange={(e) => setForm((f) => ({ ...f, durationHours: e.target.value }))}
              />
            )}
            <textarea
              className={textareaClass}
              placeholder="Reason (required)"
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleIssue} disabled={submitting}>
              {submitting ? "Saving…" : "Issue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={liftTarget !== null} onOpenChange={(v) => !submitting && !v && setLiftTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore {liftTarget?.userName ?? liftTarget?.userId}</DialogTitle>
          </DialogHeader>
          <textarea
            className={textareaClass}
            placeholder="Reason (required)"
            value={liftReason}
            onChange={(e) => setLiftReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setLiftTarget(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleLift} disabled={submitting}>
              {submitting ? "Restoring…" : "Restore"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AuditTrailPanel() {
  const [entries, setEntries] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [targetType, setTargetType] = useState("")
  const [targetId, setTargetId] = useState("")

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (targetType && targetId) {
        params.set("targetType", targetType)
        params.set("targetId", targetId)
      }
      const res = await fetch(`/api/admin/chat-moderation/audit-log?${params.toString()}`, { credentials: "include" })
      const data = await res.json().catch(() => ({}))
      setEntries((data as { entries?: AuditRow[] }).entries ?? [])
    } finally {
      setLoading(false)
    }
  }, [targetType, targetId])

  useEffect(() => {
    queueMicrotask(refresh)
  }, [refresh])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <select className={inputClass} value={targetType} onChange={(e) => setTargetType(e.target.value)}>
          <option value="">Recent activity (all)</option>
          <option value="escrow_case">Escrow case</option>
          <option value="flat_thread">Chat thread</option>
          <option value="user">User</option>
          <option value="report">Report</option>
          <option value="case_message">Case message</option>
        </select>
        {targetType && (
          <input
            className={inputClass}
            placeholder="Target id"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
          />
        )}
      </div>

      {loading ? (
        <p className="text-[13px] text-[#8b8a99]">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-[13px] text-[#8b8a99]">No audit entries.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {entries.map((e) => (
            <div key={e.id} className="rounded-lg border border-[#ececf3] bg-white px-3 py-2 text-[13px]">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-[#17161c]">{e.actionType.replace(/_/g, " ")}</span>
                <span className="text-[12px] text-[#8b8a99]">{formatDate(e.createdAt)}</span>
              </div>
              <p className="text-[12px] text-[#5c5b6a]">
                {e.actorName ?? "System"} · {e.targetType} {e.targetId.slice(0, 8)}
                {e.reason ? ` · ${e.reason}` : ""}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
