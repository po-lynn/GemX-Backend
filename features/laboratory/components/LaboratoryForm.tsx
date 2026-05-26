"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  createLaboratoryAction,
  updateLaboratoryAction,
  deleteLaboratoryAction,
} from "@/features/laboratory/actions/laboratory"
import type { LaboratoryForEdit } from "@/features/laboratory/db/laboratory"

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

function labHue(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 47 + s.charCodeAt(i)) & 0xffff
  return (h % 260) + 180
}

function ChevronRight() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

type Props = {
  mode: "create" | "edit"
  laboratory?: LaboratoryForEdit | null
}

export function LaboratoryForm({ mode, laboratory }: Props) {
  const router = useRouter()
  const isEdit = mode === "edit"

  const [name, setName] = useState(laboratory?.name ?? "")
  const [address, setAddress] = useState(laboratory?.address ?? "")
  const [phone, setPhone] = useState(laboratory?.phone ?? "")
  const [precaution, setPrecaution] = useState(laboratory?.precaution ?? "")
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function mark() { setDirty(true) }

  async function handleSave(e?: React.SyntheticEvent) {
    e?.preventDefault()
    setError(null)
    setLoading(true)
    const fd = new FormData()
    if (isEdit && laboratory) fd.set("laboratoryId", laboratory.id)
    fd.set("name", name)
    fd.set("address", address)
    fd.set("phone", phone)
    fd.set("precaution", precaution)
    const result = isEdit
      ? await updateLaboratoryAction(fd)
      : await createLaboratoryAction(fd)
    setLoading(false)
    if (result?.error) { setError(result.error); return }
    toast.success(isEdit ? "Laboratory updated" : "Laboratory created")
    setDirty(false)
    if (!isEdit) router.push("/admin/laboratory")
  }

  async function handleDelete() {
    if (!laboratory) return
    setDeleting(true)
    const fd = new FormData()
    fd.set("laboratoryId", laboratory.id)
    const result = await deleteLaboratoryAction(fd)
    if (result?.error) { toast.error(result.error); setDeleting(false); return }
    toast.success("Laboratory deleted")
    router.push("/admin/laboratory")
  }

  const initials = name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "LB"
  const hue = labHue(name || "Lab")

  const identitySection = (
    <section className="pd-sec">
      <div className="pd-sec-head">
        <div className="pd-sec-icon" data-tone="blue">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <div>
          <div className="pd-sec-title">Identity</div>
          <div className="pd-sec-sub">Official name used on certificates and product listings</div>
        </div>
      </div>
      <div className="pd-sec-body">
        <div className="pd-field">
          <label className="pd-label">
            Name <span style={{ color: "#DC2626" }}>*</span>
            <span className="pd-label-hint">e.g. GIA, AGS, IGI</span>
          </label>
          <input
            className="pd-input"
            value={name}
            onChange={e => { setName(e.target.value); mark() }}
            maxLength={200}
            required
            placeholder="e.g. GIA"
          />
        </div>
      </div>
    </section>
  )

  const contactSection = (
    <section className="pd-sec">
      <div className="pd-sec-head">
        <div className="pd-sec-icon" data-tone="purple">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
          </svg>
        </div>
        <div>
          <div className="pd-sec-title">Contact</div>
          <div className="pd-sec-sub">Physical address and phone number for this laboratory</div>
        </div>
      </div>
      <div className="pd-sec-body">
        <div className="pd-field">
          <label className="pd-label">
            Address <span style={{ color: "#DC2626" }}>*</span>
          </label>
          <input
            className="pd-input"
            value={address}
            onChange={e => { setAddress(e.target.value); mark() }}
            maxLength={500}
            required
            placeholder="e.g. 5345 Armada Dr, Carlsbad, CA 92008"
          />
        </div>
        <div className="pd-field" style={{ maxWidth: 280 }}>
          <label className="pd-label">
            Phone <span style={{ color: "#DC2626" }}>*</span>
          </label>
          <input
            className="pd-input"
            value={phone}
            onChange={e => { setPhone(e.target.value); mark() }}
            maxLength={100}
            required
            placeholder="e.g. +1 760 603 4000"
          />
        </div>
      </div>
    </section>
  )

  const precautionSection = (
    <section className="pd-sec">
      <div className="pd-sec-head">
        <div className="pd-sec-icon" data-tone="amber">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <div>
          <div className="pd-sec-title">Precaution</div>
          <div className="pd-sec-sub">Safety or handling notes shown to staff when this lab is referenced</div>
        </div>
      </div>
      <div className="pd-sec-body">
        <div className="pd-field">
          <label className="pd-label">
            Precaution notes
            <span className="pd-label-hint">Optional</span>
          </label>
          <textarea
            className="pd-input"
            value={precaution}
            onChange={e => { setPrecaution(e.target.value); mark() }}
            rows={4}
            maxLength={2000}
            placeholder="Safety or handling precautions (optional)"
            style={{ resize: "vertical", minHeight: 88 }}
          />
        </div>
      </div>
    </section>
  )

  /* ── EDIT mode — two-column enterprise layout ── */
  if (isEdit && laboratory) {
    return (
      <div>
        <div className="pd-topbar">
          <div className="pd-breadcrumbs">
            <Link href="/admin/laboratory">Laboratory</Link>
            <ChevronRight />
            <span className="pd-here">{name}</span>
          </div>
        </div>

        <div className="pd-savebar" style={{ top: 0 }}>
          {dirty
            ? <span className="pd-savebar-dirty"><span className="pd-savebar-dirty-dot" /> Unsaved changes</span>
            : <span style={{ fontSize: 12, color: "var(--lv-text-3)" }}>Saved · {fmtRelative(laboratory.updatedAt)}</span>
          }
          <span style={{ flex: 1 }} />
          <Link href="/admin/laboratory" className="pd-btn">Cancel</Link>
          <button className="pd-btn pd-btn-primary" onClick={handleSave} disabled={loading}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17,21 17,13 7,13 7,21" /><polyline points="7,3 7,8 15,8" />
            </svg>
            {loading ? "Saving…" : "Update laboratory"}
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
            <div className="lab-headcard" style={{ "--hue": hue } as React.CSSProperties}>
              <div className="lab-head-row">
                <span className="lab-avatar xl" style={{ "--hue": hue } as React.CSSProperties}>
                  <span className="lab-avatar-glyph">{initials}</span>
                </span>
                <div className="lab-head-text">
                  <div className="cat-head-eyebrow">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    Certification laboratory
                  </div>
                  <h1 className="cat-head-h">{name || "Unnamed laboratory"}</h1>
                  <div className="cat-head-pills">
                    <span className="cat-head-pill active"><span className="cat-pill-dot" />Active</span>
                    {phone && <span className="cat-head-pill">{phone}</span>}
                  </div>
                </div>
              </div>
            </div>

            {identitySection}
            {contactSection}
            {precautionSection}
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
                    <span className="pd-kv-label">Phone</span>
                    <span style={{ fontSize: 12, color: "var(--lv-text-2)", fontFamily: "var(--font-mono, monospace)" }}>{phone || "—"}</span>
                  </div>
                  <div className="pd-kv">
                    <span className="pd-kv-label">Created</span>
                    <span style={{ fontSize: 12, color: "var(--lv-text-2)" }}>{fmtDate(laboratory.createdAt)}</span>
                  </div>
                  <div className="pd-kv">
                    <span className="pd-kv-label">Updated</span>
                    <span style={{ fontSize: 12, color: "var(--lv-text-2)" }}>{fmtRelative(laboratory.updatedAt)}</span>
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
                      Delete <strong>{laboratory.name}</strong>? Products referencing this lab will have their lab cleared.
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

  /* ── CREATE mode — focused layout ── */
  return (
    <div>
      <div className="pd-topbar">
        <div className="pd-breadcrumbs">
          <Link href="/admin/laboratory">Laboratory</Link>
          <ChevronRight />
          <span className="pd-here">New laboratory</span>
        </div>
      </div>

      <div className="pd-savebar" style={{ top: 0 }}>
        <span style={{ fontSize: 12, color: "var(--lv-text-3)" }}>New laboratory</span>
        <span style={{ flex: 1 }} />
        <Link href="/admin/laboratory" className="pd-btn">Discard</Link>
        <button className="pd-btn pd-btn-primary" onClick={handleSave} disabled={loading}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17,21 17,13 7,13 7,21" /><polyline points="7,3 7,8 15,8" />
          </svg>
          {loading ? "Creating…" : "Create laboratory"}
        </button>
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid rgba(185,28,28,0.2)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#B91C1C" }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {identitySection}
        {contactSection}
        {precautionSection}
      </div>
    </div>
  )
}
