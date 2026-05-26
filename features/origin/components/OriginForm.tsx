"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  createOriginAction,
  updateOriginAction,
  deleteOriginAction,
} from "@/features/origin/actions/origin"
import type { OriginForEdit } from "@/features/origin/db/origin"

const MYANMAR_ORIGINS = ["Mogok", "Mong Hsu", "Nant Yar"] as const

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

function getInitialLocation(o: OriginForEdit | null | undefined): "" | "Myanmar" | "Other" {
  if (!o?.country) return ""
  return o.country === "Myanmar" ? "Myanmar" : "Other"
}

type Props = {
  mode: "create" | "edit"
  origin?: OriginForEdit | null
}

export function OriginForm({ mode, origin }: Props) {
  const router = useRouter()
  const isEdit = mode === "edit"

  const [location, setLocation] = useState<"" | "Myanmar" | "Other">(() => getInitialLocation(origin))
  const [name, setName] = useState(
    origin ? (origin.country === "Myanmar" ? origin.name : origin.name) : ""
  )
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function mark() { setDirty(true) }

  async function handleSave(e?: React.SyntheticEvent) {
    e?.preventDefault()
    if (!location) { setError("Please select a location type."); return }
    if (!name) { setError("Please enter an origin name."); return }
    setError(null)
    setLoading(true)
    const fd = new FormData()
    if (isEdit && origin) fd.set("originId", origin.id)
    fd.set("name", name)
    fd.set("country", location)
    const result = isEdit
      ? await updateOriginAction(fd)
      : await createOriginAction(fd)
    setLoading(false)
    if (result?.error) { setError(result.error); return }
    toast.success(isEdit ? "Origin updated" : "Origin created")
    setDirty(false)
    if (!isEdit) router.push("/admin/origin")
  }

  async function handleDelete() {
    if (!origin) return
    setDeleting(true)
    const fd = new FormData()
    fd.set("originId", origin.id)
    const result = await deleteOriginAction(fd)
    if (result?.error) { toast.error(result.error); setDeleting(false); return }
    toast.success("Origin deleted")
    router.push("/admin/origin")
  }

  const displayName = name || (isEdit ? origin?.name : "") || "New origin"

  /* ── Classification section (Myanmar vs Other) ── */
  const classificationSection = (
    <section className="pd-sec">
      <div className="pd-sec-head">
        <div className="pd-sec-icon" data-tone="amber">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
        </div>
        <div>
          <div className="pd-sec-title">Location type</div>
          <div className="pd-sec-sub">Myanmar origins have a specific region selector</div>
        </div>
      </div>
      <div className="pd-sec-body">
        <div className="cat-typecards">
          {(["Myanmar", "Other"] as const).map((t) => (
            <div
              key={t}
              className={"cat-typecard" + (location === t ? " on" : "")}
              data-type={t === "Myanmar" ? "loose" : "jewellery"}
              onClick={() => {
                setLocation(t)
                setName("")
                mark()
              }}
            >
              <span className="cat-typecard-ico">
                {t === "Myanmar" ? (
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 2a4 4 0 0 1 4 4c0 3-4 8-4 8S4 9 4 6a4 4 0 0 1 4-4z" /><circle cx="8" cy="6" r="1.5" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="8" cy="8" r="6" /><path d="M2 8h12M8 2a10 10 0 0 1 0 12M8 2a10 10 0 0 0 0 12" />
                  </svg>
                )}
              </span>
              <div className="cat-typecard-meta">
                <div className="cat-typecard-name">{t === "Myanmar" ? "Myanmar" : "Other"}</div>
                <div className="cat-typecard-sub">
                  {t === "Myanmar"
                    ? "Mogok, Mong Hsu, Nant Yar — known Myanmar gem regions."
                    : "Sri Lanka, Colombia, Mozambique, or any other country."}
                </div>
              </div>
              <span className="cat-typecard-chk" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )

  /* ── Name section (conditional on location) ── */
  const nameSection = location ? (
    <section className="pd-sec">
      <div className="pd-sec-head">
        <div className="pd-sec-icon" data-tone="blue">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
          </svg>
        </div>
        <div>
          <div className="pd-sec-title">Origin name</div>
          <div className="pd-sec-sub">
            {location === "Myanmar" ? "Select the specific Myanmar mining region" : "Enter the country or region name"}
          </div>
        </div>
      </div>
      <div className="pd-sec-body">
        {location === "Myanmar" ? (
          <div className="pd-field" style={{ maxWidth: 280 }}>
            <label className="pd-label">
              Region <span style={{ color: "#DC2626" }}>*</span>
            </label>
            <select
              className="pd-input"
              value={name}
              onChange={(e) => { setName(e.target.value); mark() }}
              style={{ cursor: "pointer" }}
            >
              <option value="">Select region</option>
              {MYANMAR_ORIGINS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="pd-field">
            <label className="pd-label">
              Country / region <span style={{ color: "#DC2626" }}>*</span>
              <span className="pd-label-hint">e.g. Sri Lanka, Colombia, Madagascar</span>
            </label>
            <input
              className="pd-input"
              value={name}
              onChange={(e) => { setName(e.target.value); mark() }}
              maxLength={200}
              required
              placeholder="e.g. Sri Lanka"
            />
          </div>
        )}
      </div>
    </section>
  ) : null

  /* ── EDIT mode ── */
  if (isEdit && origin) {
    return (
      <div>
        <div className="pd-topbar">
          <div className="pd-breadcrumbs">
            <Link href="/admin/origin">Origin</Link>
            <ChevronRight />
            <span className="pd-here">{displayName}</span>
          </div>
        </div>

        <div className="pd-savebar" style={{ top: 0 }}>
          {dirty
            ? <span className="pd-savebar-dirty"><span className="pd-savebar-dirty-dot" /> Unsaved changes</span>
            : <span style={{ fontSize: 12, color: "var(--lv-text-3)" }}>Saved · {fmtRelative(origin.updatedAt)}</span>
          }
          <span style={{ flex: 1 }} />
          <Link href="/admin/origin" className="pd-btn">Cancel</Link>
          <button className="pd-btn pd-btn-primary" onClick={handleSave} disabled={loading || !location || !name}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17,21 17,13 7,13 7,21" /><polyline points="7,3 7,8 15,8" />
            </svg>
            {loading ? "Saving…" : "Update origin"}
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
            <div className="ori-headcard">
              <div className="ori-head-row">
                <span className="ori-avatar xl" style={{ "--hue": origin.country === "Myanmar" ? 38 : 150 } as React.CSSProperties}>
                  <span className="ori-avatar-glyph">
                    {origin.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "OR"}
                  </span>
                </span>
                <div className="ori-head-text">
                  <div className="cat-head-eyebrow" style={{ "--hue": origin.country === "Myanmar" ? "38" : "150" } as React.CSSProperties}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                    Gem origin · {origin.country === "Myanmar" ? "Myanmar" : "Other"}
                  </div>
                  <h1 className="cat-head-h">{name || origin.name || "Unnamed origin"}</h1>
                  <div className="cat-head-pills">
                    <span className="cat-head-pill active"><span className="cat-pill-dot" />Active</span>
                    <span className="ori-country-pill" data-myanmar={origin.country === "Myanmar" ? "true" : undefined}>
                      <span className="ori-country-dot" />
                      {origin.country === "Myanmar" ? "Myanmar" : "Other"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {classificationSection}
            {nameSection}
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
                    <span className="pd-kv-label">Type</span>
                    <span className="ori-country-pill" data-myanmar={origin.country === "Myanmar" ? "true" : undefined}>
                      <span className="ori-country-dot" />
                      {origin.country === "Myanmar" ? "Myanmar" : "Other"}
                    </span>
                  </div>
                  <div className="pd-kv">
                    <span className="pd-kv-label">Created</span>
                    <span style={{ fontSize: 12, color: "var(--lv-text-2)" }}>{fmtDate(origin.createdAt)}</span>
                  </div>
                  <div className="pd-kv">
                    <span className="pd-kv-label">Updated</span>
                    <span style={{ fontSize: 12, color: "var(--lv-text-2)" }}>{fmtRelative(origin.updatedAt)}</span>
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
                      Delete <strong>{origin.name}</strong>? Products referencing this origin will have their origin cleared.
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
          <Link href="/admin/origin">Origin</Link>
          <ChevronRight />
          <span className="pd-here">New origin</span>
        </div>
      </div>

      <div className="pd-savebar" style={{ top: 0 }}>
        <span style={{ fontSize: 12, color: "var(--lv-text-3)" }}>New origin</span>
        <span style={{ flex: 1 }} />
        <Link href="/admin/origin" className="pd-btn">Discard</Link>
        <button className="pd-btn pd-btn-primary" onClick={handleSave} disabled={loading || !location || !name}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17,21 17,13 7,13 7,21" /><polyline points="7,3 7,8 15,8" />
          </svg>
          {loading ? "Creating…" : "Create origin"}
        </button>
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid rgba(185,28,28,0.2)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#B91C1C" }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {classificationSection}
        {nameSection}
      </div>
    </div>
  )
}
