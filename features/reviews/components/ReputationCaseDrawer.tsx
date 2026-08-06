"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ReputationCase } from "@/features/reviews/db/reputation-cases"

const SECONDARY_ACTIONS: Array<{ actionType: string; label: string }> = [
  { actionType: "warned", label: "Warn seller" },
  { actionType: "limited_orders", label: "Limit new orders" },
  { actionType: "listings_hidden", label: "Hide listings only" },
  { actionType: "documents_requested", label: "Request documents" },
  { actionType: "escalated", label: "Escalate" },
]

function fmtRelative(d: Date): string {
  const diff = (Date.now() - new Date(d).getTime()) / 1000
  if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function ReputationCaseDrawer({
  row,
  onClose,
  onArchive,
  onDismiss,
  onSecondaryAction,
  isBusy,
}: {
  row: ReputationCase
  onClose: () => void
  onArchive: (sellerUserId: string, reason: string) => void
  // Every trigger key on the case, not just the primary one — suppression is
  // per (seller, rule), so a partially dismissed case reopens immediately.
  onDismiss: (sellerUserId: string, triggerKeys: string[], reason: string) => void
  onSecondaryAction: (sellerUserId: string, actionType: string) => void
  isBusy: boolean
}) {
  const [reason, setReason] = useState("")
  const triggerKeys = row.signals.map((s) => s.triggerKey)

  return (
    <>
      <div className="lv-drawer-backdrop" onClick={onClose} />
      <aside className="lv-drawer" role="dialog" aria-label="Reputation case detail">
        <header className="lv-drawer-head">
          <div>
            <div className="lv-drawer-title">Reputation case</div>
            <div className="lv-drawer-sub">{row.sellerUserId}</div>
          </div>
          <div className="lv-drawer-actions">
            <button className="lv-drawer-close" onClick={onClose} aria-label="Close">
              <X />
            </button>
          </div>
        </header>

        <div className="lv-drawer-body">
          <section className="lv-drawer-section">
            <h3 className="lv-drawer-section-h">Seller</h3>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>{row.sellerName}</div>
            <div style={{ fontSize: 12.5, color: "var(--lv-text-3, #71717a)" }}>
              {row.avgRating.toFixed(2)} ★ · {row.reviewCount} reviews
            </div>
          </section>

          <section className="lv-drawer-section">
            <h3 className="lv-drawer-section-h">Why this seller is flagged</h3>
            {row.signals.map((s) => (
              <div
                key={s.triggerKey}
                style={{
                  padding: "10px 11px",
                  borderRadius: 10,
                  marginBottom: 8,
                  background: s.severity === "critical" ? "#FEF2F2" : "#FFF7ED",
                  color: s.severity === "critical" ? "#B91C1C" : "#C2410C",
                }}
              >
                <div style={{ fontWeight: 500, fontSize: 13 }}>{s.label}</div>
                <div style={{ fontSize: 12.5, opacity: 0.85 }}>{s.detail}</div>
              </div>
            ))}
          </section>

          <section className="lv-drawer-section">
            <h3 className="lv-drawer-section-h">Recent buyer reviews (read only)</h3>
            {row.recentReviews.length === 0 && (
              <p style={{ fontSize: 12.5, color: "var(--lv-text-3, #71717a)" }}>No reviews yet.</p>
            )}
            {row.recentReviews.map((r) => (
              <div key={r.id} style={{ border: "1px solid #F4F4F6", borderRadius: 11, padding: 10, marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                  <span style={{ fontWeight: 500 }}>{r.buyerName}</span>
                  <span style={{ color: "var(--lv-text-4, #a1a1aa)" }}>{fmtRelative(r.createdAt)}</span>
                </div>
                {r.comment && <p style={{ fontSize: 12.5, color: "#52525B", marginTop: 4 }}>{r.comment}</p>}
              </div>
            ))}
          </section>

          <section className="lv-drawer-section">
            <h3 className="lv-drawer-section-h">Seller record</h3>
            <dl className="lv-kv">
              <dt>Active listings</dt>
              <dd>{row.activeListingsCount}</dd>
              <dt>Prior warnings</dt>
              <dd>{row.priorWarningsCount}</dd>
            </dl>
          </section>

          <section className="lv-drawer-section">
            <h3 className="lv-drawer-section-h">Decision</h3>
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: 10, fontSize: 12.5, marginBottom: 10 }}>
              Archiving records this seller as archived and removes them from this case list. Phase 1
              does not yet hide their profile or their {row.activeListingsCount} listings from
              buyers — that enforcement ships in a later phase.
            </div>
            <textarea
              placeholder="Reason for the decision (stored in the audit log)…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              disabled={isBusy}
              className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <Button
                variant="destructive"
                size="sm"
                disabled={isBusy || !reason.trim()}
                onClick={() => onArchive(row.sellerUserId, reason.trim())}
              >
                Archive seller
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={isBusy || !reason.trim() || triggerKeys.length === 0}
                onClick={() => onDismiss(row.sellerUserId, triggerKeys, reason.trim())}
              >
                {triggerKeys.length > 1 ? `Dismiss all ${triggerKeys.length} flags` : "Dismiss flag"}
              </Button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {SECONDARY_ACTIONS.map((a) => (
                <button
                  key={a.actionType}
                  disabled={isBusy}
                  onClick={() => onSecondaryAction(row.sellerUserId, a.actionType)}
                  className="lv-rowbtn"
                  style={{ fontSize: 12 }}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </section>
        </div>
      </aside>
    </>
  )
}
