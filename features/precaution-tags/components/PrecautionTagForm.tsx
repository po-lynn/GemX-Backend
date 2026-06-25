"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  createPrecautionTagAction,
  updatePrecautionTagAction,
  deletePrecautionTagAction,
} from "@/features/precaution-tags/actions/precaution-tags"
import type { PrecautionTagForEdit, PrecautionTagSeverity, PrecautionTagAppliesTo } from "@/features/precaution-tags/db/precaution-tags"

function fmtDate(d: Date | null | undefined) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function fmtRelative(d: Date | null | undefined) {
  if (!d) return "—"
  const diff = (Date.now() - new Date(d).getTime()) / 1000
  if (diff < 60)     return "just now"
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return fmtDate(d)
}

function ChevronRight() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const SEVERITY_META: Record<PrecautionTagSeverity, { label: string; sub: string; icon: React.ReactNode }> = {
  critical: {
    label: "Critical",
    sub: "Urgent warning — must be acknowledged before proceeding.",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 1.5 1 14h14L8 1.5z" />
        <path d="M8 6v3.5M8 11.5h.01" />
      </svg>
    ),
  },
  warning: {
    label: "Warning",
    sub: "Important caution — buyers should take note before acting.",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="8" r="6.5" />
        <path d="M8 5v3.5M8 11h.01" />
      </svg>
    ),
  },
  info: {
    label: "Info",
    sub: "General advisory — helpful context for buyers.",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="8" r="6.5" />
        <path d="M8 7.5v4M8 5h.01" />
      </svg>
    ),
  },
}

const APPLIES_META: Record<PrecautionTagAppliesTo, { label: string; sub: string; icon: React.ReactNode }> = {
  certified: {
    label: "Certified",
    sub: "Applies to gemstones with a valid lab certificate.",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="8" r="6.5" />
        <path d="M5 8l2.5 2.5L11 6" />
      </svg>
    ),
  },
  non_certified: {
    label: "Non-Certified",
    sub: "Applies to gemstones without laboratory certification.",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="8" r="6.5" />
        <path d="M5 5l6 6M11 5l-6 6" />
      </svg>
    ),
  },
  both: {
    label: "All Products",
    sub: "Applies to all gemstones regardless of certification status.",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 8h12M8 2l4 4-4-4M8 14l4-4-4 4" />
        <path d="M8 2v12" />
      </svg>
    ),
  },
}

const SEV_LABELS: Record<PrecautionTagSeverity, string> = {
  critical: "Critical",
  warning: "Warning",
  info: "Info",
}

const APPLIES_LABELS: Record<PrecautionTagAppliesTo, string> = {
  certified: "Certified",
  non_certified: "Non-Certified",
  both: "All products",
}

type Props = {
  mode: "create" | "edit"
  precautionTag?: PrecautionTagForEdit | null
}

export function PrecautionTagForm({ mode, precautionTag }: Props) {
  const router = useRouter()
  const isEdit = mode === "edit"

  const [name, setName] = useState(precautionTag?.name ?? "")
  const [severity, setSeverity] = useState<PrecautionTagSeverity>(precautionTag?.severity ?? "warning")
  const [appliesTo, setAppliesTo] = useState<PrecautionTagAppliesTo>(precautionTag?.appliesTo ?? "both")
  const [isActive, setIsActive] = useState(precautionTag?.isActive ?? true)
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function mark() { setDirty(true) }

  async function handleSave(e?: React.SyntheticEvent) {
    e?.preventDefault()
    if (!name.trim()) { setError("Tag name is required."); return }
    setError(null)
    setLoading(true)
    const fd = new FormData()
    if (isEdit && precautionTag) fd.set("precautionTagId", precautionTag.id)
    fd.set("name", name.trim())
    fd.set("severity", severity)
    fd.set("appliesTo", appliesTo)
    if (isActive) fd.set("isActive", "on")
    const result = isEdit
      ? await updatePrecautionTagAction(fd)
      : await createPrecautionTagAction(fd)
    setLoading(false)
    if (result?.error) { setError(result.error); return }
    toast.success(isEdit ? "Precaution updated" : "Precaution created")
    setDirty(false)
    if (!isEdit) router.push("/admin/settings/precaution-tags")
  }

  async function handleDelete() {
    if (!precautionTag) return
    setDeleting(true)
    const fd = new FormData()
    fd.set("precautionTagId", precautionTag.id)
    const result = await deletePrecautionTagAction(fd)
    if (result?.error) { toast.error(result.error); setDeleting(false); return }
    toast.success("Precaution deleted")
    router.push("/admin/settings/precaution-tags")
  }

  /* ── Sections ── */
  const identitySection = (
    <section className="pd-sec">
      <div className="pd-sec-head">
        <div className="pd-sec-icon" data-tone="purple">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3 4 6v6c0 5 3.4 7.8 8 9 4.6-1.2 8-4 8-9V6z" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
        </div>
        <div>
          <div className="pd-sec-title">Precaution text</div>
          <div className="pd-sec-sub">The advisory message shown to buyers</div>
        </div>
      </div>
      <div className="pd-sec-body">
        <div className="pd-field">
          <label className="pd-label">
            Name <span style={{ color: "#DC2626" }}>*</span>
            <span className="pd-label-hint">e.g. No lab certificate, No off-platform payment</span>
          </label>
          <input
            className="pd-input"
            value={name}
            onChange={e => { setName(e.target.value); mark() }}
            maxLength={200}
            required
            placeholder="e.g. No lab certificate"
          />
          {name && (
            <div style={{ marginTop: 8 }}>
              <span className="pct-tag-chip" data-severity={severity} style={{ fontSize: 12 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3 4 6v6c0 5 3.4 7.8 8 9 4.6-1.2 8-4 8-9V6z" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
                {name}
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  )

  const severitySection = (
    <section className="pd-sec">
      <div className="pd-sec-head">
        <div className="pd-sec-icon" data-tone="red">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <div>
          <div className="pd-sec-title">Severity</div>
          <div className="pd-sec-sub">Controls urgency styling shown to buyers</div>
        </div>
      </div>
      <div className="pd-sec-body">
        <div className="rt-typecards">
          {(["critical", "warning", "info"] as const).map((s) => {
            const meta = SEVERITY_META[s]
            return (
              <div
                key={s}
                className={"rt-typecard" + (severity === s ? " on" : "")}
                data-type={s === "critical" ? "negative" : s === "warning" ? "neutral" : "positive"}
                onClick={() => { setSeverity(s); mark() }}
              >
                <span className="rt-typecard-ico">{meta.icon}</span>
                <div className="rt-typecard-meta">
                  <div className="rt-typecard-name">{meta.label}</div>
                  <div className="rt-typecard-sub">{meta.sub}</div>
                </div>
                <span className="rt-typecard-chk" />
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )

  const appliesToSection = (
    <section className="pd-sec">
      <div className="pd-sec-head">
        <div className="pd-sec-icon" data-tone="blue">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />
          </svg>
        </div>
        <div>
          <div className="pd-sec-title">Applies to</div>
          <div className="pd-sec-sub">Which certification context surfaces this precaution</div>
        </div>
      </div>
      <div className="pd-sec-body">
        <div className="rt-typecards">
          {(["certified", "non_certified", "both"] as const).map((a) => {
            const meta = APPLIES_META[a]
            const dataType = a === "certified" ? "positive" : a === "non_certified" ? "negative" : "neutral"
            return (
              <div
                key={a}
                className={"rt-typecard" + (appliesTo === a ? " on" : "")}
                data-type={dataType}
                onClick={() => { setAppliesTo(a); mark() }}
              >
                <span className="rt-typecard-ico">{meta.icon}</span>
                <div className="rt-typecard-meta">
                  <div className="rt-typecard-name">{meta.label}</div>
                  <div className="rt-typecard-sub">{meta.sub}</div>
                </div>
                <span className="rt-typecard-chk" />
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )

  const visibilitySection = (
    <section className="pd-sec">
      <div className="pd-sec-head">
        <div className="pd-sec-icon" data-tone={isActive ? "green" : "amber"}>
          {isActive ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          )}
        </div>
        <div>
          <div className="pd-sec-title">Visibility</div>
          <div className="pd-sec-sub">Hidden tags stay in the database but are not shown to buyers</div>
        </div>
      </div>
      <div className="pd-sec-body">
        <div
          className={"rt-vis-toggle" + (isActive ? " on" : "")}
          onClick={() => { setIsActive(!isActive); mark() }}
          role="switch"
          aria-checked={isActive}
          tabIndex={0}
          onKeyDown={e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); setIsActive(!isActive); mark() } }}
        >
          <span className="rt-vis-track">
            <span className="rt-vis-thumb" />
          </span>
          <div className="rt-vis-label">
            <span className="rt-vis-label-main">{isActive ? "Visible to buyers" : "Hidden from buyers"}</span>
            <span className="rt-vis-label-sub">
              {isActive
                ? "This precaution will be shown to buyers before they interact with a product."
                : "Precaution exists in the system but won't appear on buyer-facing surfaces."}
            </span>
          </div>
        </div>
      </div>
    </section>
  )

  /* ── EDIT mode ── */
  if (isEdit && precautionTag) {
    return (
      <div>
        <div className="pd-topbar">
          <div className="pd-breadcrumbs">
            <Link href="/admin/settings/precaution-tags">Precaution tags</Link>
            <ChevronRight />
            <span className="pd-here">{name || precautionTag.name}</span>
          </div>
        </div>

        <div className="pd-savebar" style={{ top: 0 }}>
          {dirty
            ? <span className="pd-savebar-dirty"><span className="pd-savebar-dirty-dot" /> Unsaved changes</span>
            : <span style={{ fontSize: 12, color: "var(--lv-text-3)" }}>Saved · {fmtRelative(precautionTag.updatedAt)}</span>
          }
          <span style={{ flex: 1 }} />
          <Link href="/admin/settings/precaution-tags" className="pd-btn">Cancel</Link>
          <button className="pd-btn pd-btn-primary" onClick={handleSave} disabled={loading}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17,21 17,13 7,13 7,21" /><polyline points="7,3 7,8 15,8" />
            </svg>
            {loading ? "Saving…" : "Update precaution"}
          </button>
        </div>

        {error && (
          <div style={{ background: "#FEF2F2", border: "1px solid rgba(185,28,28,0.2)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#B91C1C" }}>
            {error}
          </div>
        )}

        <div className="pd-grid">
          <div className="pd-main">
            {/* Hero card */}
            <div className="pct-headcard" data-severity={severity}>
              <div className="rt-head-row">
                <span className="pct-head-icon" data-severity={severity}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3 4 6v6c0 5 3.4 7.8 8 9 4.6-1.2 8-4 8-9V6z" />
                    <path d="M12 8v4M12 16h.01" />
                  </svg>
                </span>
                <div>
                  <div className="rt-head-eyebrow">Precaution tag · {SEV_LABELS[severity]}</div>
                  <h1 className="cat-head-h" style={{ fontSize: 22 }}>{name || precautionTag.name || "Unnamed precaution"}</h1>
                  <div className="cat-head-pills" style={{ marginTop: 6 }}>
                    {isActive
                      ? <span className="rt-vis-pill active">Visible</span>
                      : <span className="rt-vis-pill hidden-tag">Hidden</span>
                    }
                    <span className="pct-sevpill" data-severity={severity}>
                      <span className="pct-sevpill-dot" />{SEV_LABELS[severity]}
                    </span>
                    <span className="pct-applies-pill" data-applies={appliesTo}>
                      {APPLIES_LABELS[appliesTo]}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {identitySection}
            {severitySection}
            {appliesToSection}
            {visibilitySection}
          </div>

          <div className="pd-side">
            <div className="pd-sidecard">
              <div className="pd-sidecard-head">
                <div className="pd-sidecard-icon">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
                  </svg>
                </div>
                <div>
                  <div className="pd-sidecard-title">Status</div>
                  <div className="pd-sidecard-sub">Lifecycle &amp; audit</div>
                </div>
              </div>
              <div className="pd-sidecard-body">
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div className="pd-kv">
                    <span className="pd-kv-label">Severity</span>
                    <span className="pct-sevpill" data-severity={severity}>
                      <span className="pct-sevpill-dot" />{SEV_LABELS[severity]}
                    </span>
                  </div>
                  <div className="pd-kv">
                    <span className="pd-kv-label">Applies to</span>
                    <span className="pct-applies-pill" data-applies={appliesTo}>
                      {APPLIES_LABELS[appliesTo]}
                    </span>
                  </div>
                  <div className="pd-kv">
                    <span className="pd-kv-label">Visibility</span>
                    {isActive
                      ? <span className="rt-vis-pill active">Visible</span>
                      : <span className="rt-vis-pill hidden-tag">Hidden</span>
                    }
                  </div>
                  <div className="pd-kv">
                    <span className="pd-kv-label">Created</span>
                    <span style={{ fontSize: 12, color: "var(--lv-text-2)" }}>{fmtDate(precautionTag.createdAt)}</span>
                  </div>
                  <div className="pd-kv">
                    <span className="pd-kv-label">Updated</span>
                    <span style={{ fontSize: 12, color: "var(--lv-text-2)" }}>{fmtRelative(precautionTag.updatedAt)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pd-sidecard">
              <div className="pd-sidecard-head">
                <div className="pd-sidecard-icon" style={{ background: "#FEF2F2", color: "#B91C1C" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                  </svg>
                </div>
                <div>
                  <div className="pd-sidecard-title">Danger zone</div>
                  <div className="pd-sidecard-sub">Irreversible actions</div>
                </div>
              </div>
              <div className="pd-sidecard-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {!showDeleteConfirm ? (
                  <button
                    className="pd-btn"
                    style={{ color: "#B91C1C", borderColor: "rgba(185,28,28,0.25)", justifyContent: "center" }}
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                    </svg>
                    Delete permanently
                  </button>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <p style={{ fontSize: 12, color: "var(--lv-text-2)", lineHeight: 1.5, margin: 0 }}>
                      Delete <strong>{precautionTag.name}</strong>? This removes the precaution from the system.
                    </p>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        className="pd-btn"
                        style={{ background: "#B91C1C", color: "#fff", borderColor: "transparent", flex: 1, justifyContent: "center" }}
                        onClick={handleDelete}
                        disabled={deleting}
                      >
                        {deleting ? "Deleting…" : "Confirm delete"}
                      </button>
                      <button className="pd-btn" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                    </div>
                  </div>
                )}
                <span style={{ fontSize: 11, color: "var(--lv-text-3)", lineHeight: 1.45 }}>
                  Deletion is permanent and cannot be undone.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ── CREATE mode ── */
  return (
    <div>
      <div className="pd-topbar">
        <div className="pd-breadcrumbs">
          <Link href="/admin/settings/precaution-tags">Precaution tags</Link>
          <ChevronRight />
          <span className="pd-here">New precaution</span>
        </div>
      </div>

      <div className="pd-savebar" style={{ top: 0 }}>
        <span style={{ fontSize: 12, color: "var(--lv-text-3)" }}>New precaution tag</span>
        <span style={{ flex: 1 }} />
        <Link href="/admin/settings/precaution-tags" className="pd-btn">Discard</Link>
        <button className="pd-btn pd-btn-primary" onClick={handleSave} disabled={loading}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17,21 17,13 7,13 7,21" /><polyline points="7,3 7,8 15,8" />
          </svg>
          {loading ? "Creating…" : "Create precaution"}
        </button>
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid rgba(185,28,28,0.2)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#B91C1C" }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {identitySection}
        {severitySection}
        {appliesToSection}
        {visibilitySection}
      </div>
    </div>
  )
}
