"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  createColorAction,
  updateColorAction,
  deleteColorAction,
} from "@/features/colors/actions/color"
import type { ColorForEdit } from "@/features/colors/db/color"
import { ColorSwatch } from "./ColorListView"

const HEX_RE = /^#[0-9a-fA-F]{6}$/

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

type Props = {
  mode: "create" | "edit"
  color?: ColorForEdit | null
}

export function ColorForm({ mode, color }: Props) {
  const router = useRouter()
  const isEdit = mode === "edit"

  const [name, setName] = useState(color?.name ?? "")
  const [hexCode, setHexCode] = useState(color?.hexCode ?? "")
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function mark() { setDirty(true) }

  const hexValid = hexCode === "" || HEX_RE.test(hexCode)

  async function handleSave(e?: React.SyntheticEvent) {
    e?.preventDefault()
    if (!name.trim()) { setError("Please enter a colour name."); return }
    if (!hexValid) { setError("Hex code must look like #9B111E, or be left empty."); return }
    setError(null)
    setLoading(true)
    const fd = new FormData()
    if (isEdit && color) fd.set("colorId", color.id)
    fd.set("name", name.trim())
    fd.set("hexCode", hexCode)
    const result = isEdit
      ? await updateColorAction(fd)
      : await createColorAction(fd)
    setLoading(false)
    if (result?.error) { setError(result.error); return }
    toast.success(isEdit ? "Colour updated" : "Colour created")
    setDirty(false)
    router.push("/admin/colors")
  }

  async function handleDelete() {
    if (!color) return
    setDeleting(true)
    const fd = new FormData()
    fd.set("colorId", color.id)
    const result = await deleteColorAction(fd)
    if (result?.error) { toast.error(result.error); setDeleting(false); return }
    toast.success("Colour deleted")
    router.push("/admin/colors")
  }

  const displayName = name || (isEdit ? color?.name : "") || "New colour"

  const detailsSection = (
    <section className="pd-sec">
      <div className="pd-sec-head">
        <div className="pd-sec-icon" data-tone="blue">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="13.5" cy="6.5" r=".5" /><circle cx="17.5" cy="10.5" r=".5" />
            <circle cx="8.5" cy="7.5" r=".5" /><circle cx="6.5" cy="12.5" r=".5" />
            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
          </svg>
        </div>
        <div>
          <div className="pd-sec-title">Colour details</div>
          <div className="pd-sec-sub">Name shown in pickers; hex renders the swatch</div>
        </div>
      </div>
      <div className="pd-sec-body">
        <div className="pd-field" style={{ maxWidth: 360 }}>
          <label className="pd-label" htmlFor="clr-name">
            Colour name <span style={{ color: "#DC2626" }}>*</span>
            <span className="pd-label-hint">e.g. Pigeon Blood Red</span>
          </label>
          <input
            id="clr-name"
            className="pd-input"
            value={name}
            onChange={(e) => { setName(e.target.value); mark() }}
            maxLength={100}
            required
            placeholder="e.g. Royal Blue"
          />
        </div>
        <div className="pd-field" style={{ maxWidth: 360, marginTop: 14 }}>
          <label className="pd-label" htmlFor="clr-hex">
            Hex code
            <span className="pd-label-hint">optional — leave empty for Multi-color / Bi-color</span>
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              id="clr-hex"
              className="pd-input"
              value={hexCode}
              onChange={(e) => { setHexCode(e.target.value.trim()); mark() }}
              maxLength={7}
              placeholder="#9B111E"
              style={{ fontFamily: "ui-monospace, monospace", flex: 1 }}
            />
            <input
              type="color"
              aria-label="Pick colour"
              value={HEX_RE.test(hexCode) ? hexCode : "#888888"}
              onChange={(e) => { setHexCode(e.target.value.toUpperCase()); mark() }}
              style={{ width: 36, height: 36, padding: 2, border: "1px solid rgba(15,23,42,0.15)", borderRadius: 8, cursor: "pointer", background: "transparent" }}
            />
            <ColorSwatch hex={hexValid ? hexCode : ""} size={24} />
            {hexCode !== "" && (
              <button
                type="button"
                className="pd-btn"
                onClick={() => { setHexCode(""); mark() }}
              >
                No swatch
              </button>
            )}
          </div>
          {!hexValid && (
            <span style={{ fontSize: 11.5, color: "#B91C1C", marginTop: 4, display: "block" }}>
              Must look like #9B111E
            </span>
          )}
        </div>
      </div>
    </section>
  )

  const errorBanner = error ? (
    <div style={{ background: "#FEF2F2", border: "1px solid rgba(185,28,28,0.2)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#B91C1C" }}>
      {error}
    </div>
  ) : null

  const saveIcon = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17,21 17,13 7,13 7,21" /><polyline points="7,3 7,8 15,8" />
    </svg>
  )

  if (isEdit && color) {
    return (
      <div>
        <div className="pd-topbar">
          <div className="pd-breadcrumbs">
            <Link href="/admin/colors">Color</Link>
            <ChevronRight />
            <span className="pd-here">{displayName}</span>
          </div>
        </div>

        <div className="pd-savebar" style={{ top: 0 }}>
          {dirty
            ? <span className="pd-savebar-dirty"><span className="pd-savebar-dirty-dot" /> Unsaved changes</span>
            : <span style={{ fontSize: 12, color: "var(--lv-text-3)" }}>Saved · {fmtRelative(color.updatedAt)}</span>
          }
          <span style={{ flex: 1 }} />
          <Link href="/admin/colors" className="pd-btn">Cancel</Link>
          <button className="pd-btn pd-btn-primary" onClick={handleSave} disabled={loading || !name.trim() || !hexValid}>
            {saveIcon}
            {loading ? "Saving…" : "Update colour"}
          </button>
        </div>

        {errorBanner}

        <div className="pd-grid">
          <div className="pd-main">
            {detailsSection}
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
                    <span className="pd-kv-label">Swatch</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                      <ColorSwatch hex={hexValid ? hexCode : color.hexCode} size={16} />
                      <span style={{ fontSize: 12, fontFamily: "ui-monospace, monospace", color: "var(--lv-text-2)" }}>
                        {(hexValid ? hexCode : color.hexCode) || "none"}
                      </span>
                    </span>
                  </div>
                  <div className="pd-kv">
                    <span className="pd-kv-label">Created</span>
                    <span style={{ fontSize: 12, color: "var(--lv-text-2)" }}>{fmtDate(color.createdAt)}</span>
                  </div>
                  <div className="pd-kv">
                    <span className="pd-kv-label">Updated</span>
                    <span style={{ fontSize: 12, color: "var(--lv-text-2)" }}>{fmtRelative(color.updatedAt)}</span>
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
                      Delete <strong>{color.name}</strong>? Products using this colour keep their colour text; only the link is cleared.
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

  return (
    <div>
      <div className="pd-topbar">
        <div className="pd-breadcrumbs">
          <Link href="/admin/colors">Color</Link>
          <ChevronRight />
          <span className="pd-here">New colour</span>
        </div>
      </div>

      <div className="pd-savebar" style={{ top: 0 }}>
        <span style={{ fontSize: 12, color: "var(--lv-text-3)" }}>New colour</span>
        <span style={{ flex: 1 }} />
        <Link href="/admin/colors" className="pd-btn">Discard</Link>
        <button className="pd-btn pd-btn-primary" onClick={handleSave} disabled={loading}>
          {saveIcon}
          {loading ? "Creating…" : "Create colour"}
        </button>
      </div>

      {errorBanner}

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {detailsSection}
      </div>
    </div>
  )
}
