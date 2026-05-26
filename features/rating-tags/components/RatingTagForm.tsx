"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  createRatingTagAction,
  updateRatingTagAction,
  deleteRatingTagAction,
} from "@/features/rating-tags/actions/rating-tags"
import type { RatingTagForEdit } from "@/features/rating-tags/db/rating-tags"

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

const TYPE_META = {
  positive: {
    label: "Positive",
    sub: "Praise — fast shipping, great quality, professional.",
    tone: "green",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9.33 6V3.33a2 2 0 0 0-2-2L4.67 8v7.33H12.2a1.33 1.33 0 0 0 1.33-1.13l.92-6A1.33 1.33 0 0 0 13.12 6H9.33z" />
        <path d="M4.67 8H2.67A1.33 1.33 0 0 0 1.33 9.33v4.67A1.33 1.33 0 0 0 2.67 15.33h2" />
      </svg>
    ),
  },
  neutral: {
    label: "Neutral",
    sub: "Mixed or informational — as described, average response.",
    tone: "blue",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="8" r="6.5" />
        <path d="M5.5 9.5h5M5.5 6.5h5" />
      </svg>
    ),
  },
  negative: {
    label: "Negative",
    sub: "Criticism — slow shipping, poor condition, unresponsive.",
    tone: "red",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6.67 10v2.67a2 2 0 0 0 2 2l2.66-5.33V2h-7.5A1.33 1.33 0 0 0 2.5 3.13l-.92 6A1.33 1.33 0 0 0 2.88 10H6.67z" />
        <path d="M11.33 8h2A1.33 1.33 0 0 0 14.67 6.67V2A1.33 1.33 0 0 0 13.33.67h-2" />
      </svg>
    ),
  },
} as const

type TagType = "positive" | "neutral" | "negative"

type Props = {
  mode: "create" | "edit"
  ratingTag?: RatingTagForEdit | null
}

export function RatingTagForm({ mode, ratingTag }: Props) {
  const router = useRouter()
  const isEdit = mode === "edit"

  const [name, setName] = useState(ratingTag?.name ?? "")
  const [type, setType] = useState<TagType>(ratingTag?.type ?? "positive")
  const [isActive, setIsActive] = useState(ratingTag?.isActive ?? true)
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
    if (isEdit && ratingTag) fd.set("ratingTagId", ratingTag.id)
    fd.set("name", name.trim())
    fd.set("type", type)
    if (isActive) fd.set("isActive", "on")
    const result = isEdit
      ? await updateRatingTagAction(fd)
      : await createRatingTagAction(fd)
    setLoading(false)
    if (result?.error) { setError(result.error); return }
    toast.success(isEdit ? "Tag updated" : "Tag created")
    setDirty(false)
    if (!isEdit) router.push("/admin/settings/rating-tags")
  }

  async function handleDelete() {
    if (!ratingTag) return
    setDeleting(true)
    const fd = new FormData()
    fd.set("ratingTagId", ratingTag.id)
    const result = await deleteRatingTagAction(fd)
    if (result?.error) { toast.error(result.error); setDeleting(false); return }
    toast.success("Tag deleted")
    router.push("/admin/settings/rating-tags")
  }

  /* ── Sections ── */
  const identitySection = (
    <section className="pd-sec">
      <div className="pd-sec-head">
        <div className="pd-sec-icon" data-tone="purple">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
            <line x1="7" y1="7" x2="7.01" y2="7" />
          </svg>
        </div>
        <div>
          <div className="pd-sec-title">Tag label</div>
          <div className="pd-sec-sub">Short phrase buyers see when rating a seller</div>
        </div>
      </div>
      <div className="pd-sec-body">
        <div className="pd-field">
          <label className="pd-label">
            Name <span style={{ color: "#DC2626" }}>*</span>
            <span className="pd-label-hint">e.g. Fast shipping, Great quality</span>
          </label>
          <input
            className="pd-input"
            value={name}
            onChange={e => { setName(e.target.value); mark() }}
            maxLength={200}
            required
            placeholder="e.g. Fast shipping"
          />
          {name && (
            <div style={{ marginTop: 8 }}>
              <span className="rt-tag-chip" data-type={type} style={{ fontSize: 12 }}>
                {name}
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  )

  const sentimentSection = (
    <section className="pd-sec">
      <div className="pd-sec-head">
        <div className="pd-sec-icon" data-tone="blue">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M8 14s1.5 2 4 2 4-2 4-2" />
            <line x1="9" y1="9" x2="9.01" y2="9" />
            <line x1="15" y1="9" x2="15.01" y2="9" />
          </svg>
        </div>
        <div>
          <div className="pd-sec-title">Sentiment</div>
          <div className="pd-sec-sub">Controls colour coding and grouping in rating summaries</div>
        </div>
      </div>
      <div className="pd-sec-body">
        <div className="rt-typecards">
          {(["positive", "neutral", "negative"] as const).map((t) => {
            const meta = TYPE_META[t]
            return (
              <div
                key={t}
                className={"rt-typecard" + (type === t ? " on" : "")}
                data-type={t}
                onClick={() => { setType(t); mark() }}
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
          <div className="pd-sec-sub">Hidden tags stay in the database but are not shown to users</div>
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
            <span className="rt-vis-label-main">{isActive ? "Visible to users" : "Hidden from users"}</span>
            <span className="rt-vis-label-sub">
              {isActive
                ? "Buyers will see this tag when submitting a rating."
                : "Tag exists in the system but won't appear in the rating picker."}
            </span>
          </div>
        </div>
      </div>
    </section>
  )

  /* ── EDIT mode ── */
  if (isEdit && ratingTag) {
    return (
      <div>
        <div className="pd-topbar">
          <div className="pd-breadcrumbs">
            <Link href="/admin/settings/rating-tags">Rating tags</Link>
            <ChevronRight />
            <span className="pd-here">{name || ratingTag.name}</span>
          </div>
        </div>

        <div className="pd-savebar" style={{ top: 0 }}>
          {dirty
            ? <span className="pd-savebar-dirty"><span className="pd-savebar-dirty-dot" /> Unsaved changes</span>
            : <span style={{ fontSize: 12, color: "var(--lv-text-3)" }}>Saved · {fmtRelative(ratingTag.updatedAt)}</span>
          }
          <span style={{ flex: 1 }} />
          <Link href="/admin/settings/rating-tags" className="pd-btn">Cancel</Link>
          <button className="pd-btn pd-btn-primary" onClick={handleSave} disabled={loading}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17,21 17,13 7,13 7,21" /><polyline points="7,3 7,8 15,8" />
            </svg>
            {loading ? "Saving…" : "Update tag"}
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
            <div className="rt-headcard" data-type={type}>
              <div className="rt-head-row">
                <span className="rt-head-icon" data-type={type}>
                  {TYPE_META[type].icon}
                </span>
                <div>
                  <div className="rt-head-eyebrow">Seller rating tag · {TYPE_META[type].label}</div>
                  <h1 className="cat-head-h" style={{ fontSize: 22 }}>{name || ratingTag.name || "Unnamed tag"}</h1>
                  <div className="cat-head-pills" style={{ marginTop: 6 }}>
                    {isActive
                      ? <span className="rt-vis-pill active">Visible</span>
                      : <span className="rt-vis-pill hidden-tag">Hidden</span>
                    }
                    <span className="rt-typepill" data-type={type}>
                      <span className="rt-typepill-dot" />{TYPE_META[type].label}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {identitySection}
            {sentimentSection}
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
                    <span className="pd-kv-label">Sentiment</span>
                    <span className="rt-typepill" data-type={type}>
                      <span className="rt-typepill-dot" />{TYPE_META[type].label}
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
                    <span style={{ fontSize: 12, color: "var(--lv-text-2)" }}>{fmtDate(ratingTag.createdAt)}</span>
                  </div>
                  <div className="pd-kv">
                    <span className="pd-kv-label">Updated</span>
                    <span style={{ fontSize: 12, color: "var(--lv-text-2)" }}>{fmtRelative(ratingTag.updatedAt)}</span>
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
                      Delete <strong>{ratingTag.name}</strong>? This removes the tag from the system.
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
          <Link href="/admin/settings/rating-tags">Rating tags</Link>
          <ChevronRight />
          <span className="pd-here">New tag</span>
        </div>
      </div>

      <div className="pd-savebar" style={{ top: 0 }}>
        <span style={{ fontSize: 12, color: "var(--lv-text-3)" }}>New rating tag</span>
        <span style={{ flex: 1 }} />
        <Link href="/admin/settings/rating-tags" className="pd-btn">Discard</Link>
        <button className="pd-btn pd-btn-primary" onClick={handleSave} disabled={loading}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17,21 17,13 7,13 7,21" /><polyline points="7,3 7,8 15,8" />
          </svg>
          {loading ? "Creating…" : "Create tag"}
        </button>
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid rgba(185,28,28,0.2)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#B91C1C" }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {identitySection}
        {sentimentSection}
        {visibilitySection}
      </div>
    </div>
  )
}
