"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { createCategoryAction, updateCategoryAction, deleteCategoryAction } from "@/features/categories/actions/categories"
import type { CategoryRow } from "@/features/categories/db/categories"

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
const MAX_IMAGE_SIZE_MB = 5

type Props = {
  mode: "create" | "edit"
  category?: CategoryRow | null
  prevHref?: string | null
  nextHref?: string | null
  listPosition?: number | null
  listTotal?: number | null
}

function toSlugClient(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_-]/g, "")
}

function fmtDate(d: Date | null | undefined) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function fmtRelative(d: Date | null | undefined) {
  if (!d) return "—"
  const diff = (Date.now() - new Date(d).getTime()) / 1000
  if (diff < 60) return "just now"
  if (diff < 3600) return Math.floor(diff / 60) + "m ago"
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago"
  if (diff < 604800) return Math.floor(diff / 86400) + "d ago"
  return fmtDate(d)
}

function TypePill({ type }: { type: "loose_stone" | "jewellery" }) {
  return (
    <span className="cat-typepill" data-type={type === "loose_stone" ? "loose" : "jewellery"}>
      <span className="cat-typepill-dot" />
      {type === "loose_stone" ? "Loose stone" : "Jewellery"}
    </span>
  )
}

export function CategoryForm({ mode, category, prevHref, nextHref, listPosition, listTotal }: Props) {
  const router = useRouter()
  const isEdit = mode === "edit"

  const [name, setName] = useState(category?.name ?? "")
  const [shortCode, setShortCode] = useState(category?.shortCode ?? "")
  const [slug, setSlug] = useState(category?.slug ?? "")
  const [type, setType] = useState<"loose_stone" | "jewellery">(category?.type ?? "loose_stone")
  const [sortOrder, setSortOrder] = useState(category?.sortOrder ?? 0)
  const [imageUrl, setImageUrl] = useState(category?.image ?? "")
  const [imageUploadError, setImageUploadError] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function mark() { setDirty(true) }

  function handleName(v: string) {
    setName(v)
    if (!isEdit) setSlug(toSlugClient(v))
    mark()
  }

  function handleCode(v: string) {
    setShortCode(v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))
    mark()
  }

  function handleSlug(v: string) {
    setSlug(v.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-"))
    mark()
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    setImageUploadError(null)
    const file = e.target.files?.[0]
    if (!file) { setImageUrl(""); return }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImageUploadError(`Allowed: ${ALLOWED_IMAGE_TYPES.join(", ")}`); e.target.value = ""; return
    }
    if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      setImageUploadError(`Max ${MAX_IMAGE_SIZE_MB} MB`); e.target.value = ""; return
    }
    const fd = new FormData()
    fd.set("file", file)
    setUploadingImage(true)
    try {
      const res = await fetch("/api/categories/image", { method: "POST", body: fd, credentials: "include" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setImageUploadError(data?.error ?? "Upload failed"); e.target.value = ""; return }
      if (data?.url) { setImageUrl(data.url); mark() } else { setImageUploadError("Upload failed") }
      e.target.value = ""
    } catch {
      setImageUploadError("Upload failed"); e.target.value = ""
    } finally {
      setUploadingImage(false)
    }
  }

  async function handleSave(e?: React.SyntheticEvent) {
    e?.preventDefault()
    setError(null)
    setLoading(true)
    const fd = new FormData()
    if (isEdit && category) fd.set("id", category.id)
    fd.set("name", name)
    fd.set("shortCode", shortCode)
    fd.set("type", type)
    fd.set("sortOrder", String(sortOrder))
    if (imageUrl.trim()) fd.set("image", imageUrl.trim())
    const result = isEdit ? await updateCategoryAction(fd) : await createCategoryAction(fd)
    setLoading(false)
    if (result?.error) { setError(result.error); return }
    toast.success(isEdit ? "Category updated" : "Category created")
    setDirty(false)
    if (!isEdit) {
      setName("")
      setShortCode("")
      setSlug("")
      setType("loose_stone")
      setSortOrder(0)
      setImageUrl("")
      router.push("/admin/categories")
    }
  }

  async function handleDelete() {
    if (!category) return
    setDeleting(true)
    const fd = new FormData()
    fd.set("id", category.id)
    const result = await deleteCategoryAction(fd)
    if (result?.error) { toast.error(result.error); setDeleting(false); return }
    toast.success("Category deleted")
    router.push("/admin/categories")
  }

  const initials = name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "GX"

  /* ── Shared sections ── */
  const identitySection = (
    <section className="pd-sec">
      <div className="pd-sec-head">
        <div className="pd-sec-icon" data-tone="purple">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <div>
          <div className="pd-sec-title">Identity</div>
          <div className="pd-sec-sub">Display name, short code, and URL slug</div>
        </div>
      </div>
      <div className="pd-sec-body">
        <div className="pd-field">
          <label className="pd-label">
            Name <span style={{ color: "#DC2626" }}>*</span>
            <span className="pd-label-hint">Shown to buyers</span>
          </label>
          <input className="pd-input" value={name} onChange={e => handleName(e.target.value)} maxLength={100} required placeholder="e.g. Ruby, Ring" />
        </div>
        <div className="pd-row" style={{ "--cols": "2" } as React.CSSProperties}>
          <div className="pd-field">
            <label className="pd-label">
              Short code <span style={{ color: "#DC2626" }}>*</span>
              <span className="pd-label-hint">A–Z · up to 8 chars</span>
            </label>
            <input
              className="pd-input pd-input-mono"
              value={shortCode}
              onChange={e => handleCode(e.target.value)}
              maxLength={8} required placeholder="e.g. RUBY"
            />
            <span className="cat-codepreview">
              Stored as <span className="cat-codepreview-pill">{shortCode || "CODE"}</span>
            </span>
          </div>
          <div className="pd-field">
            <label className="pd-label">
              URL slug
              <span className="pd-label-hint">/categories/<strong>{slug || "slug"}</strong></span>
            </label>
            <input className="pd-input pd-input-mono" value={slug} onChange={e => handleSlug(e.target.value)} placeholder="auto-derived from name" />
          </div>
        </div>
        <div className="pd-field" style={{ maxWidth: 160 }}>
          <label className="pd-label">Sort order</label>
          <input className="pd-input" type="number" min={0} value={sortOrder} onChange={e => { setSortOrder(Number(e.target.value)); mark() }} />
        </div>
      </div>
    </section>
  )

  const classificationSection = (
    <section className="pd-sec">
      <div className="pd-sec-head">
        <div className="pd-sec-icon" data-tone="blue">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          </svg>
        </div>
        <div>
          <div className="pd-sec-title">Classification</div>
          <div className="pd-sec-sub">Top-level type — controls which product form fields apply</div>
        </div>
      </div>
      <div className="pd-sec-body">
        <div className="cat-typecards">
          {(["loose_stone", "jewellery"] as const).map(t => (
            <div
              key={t}
              className={"cat-typecard" + (type === t ? " on" : "")}
              data-type={t === "loose_stone" ? "loose" : "jewellery"}
              onClick={() => { setType(t); mark() }}
            >
              <span className="cat-typecard-ico">
                {t === "loose_stone" ? (
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 2.5h8L14 6 8 13.5 2 6z" /><path d="M2 6h12M6 6 8 13.5 10 6M6 6l2-3.5 2 3.5" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m6 4 2-2 2 2-2 2z" /><circle cx="8" cy="10.5" r="3.5" />
                  </svg>
                )}
              </span>
              <div className="cat-typecard-meta">
                <div className="cat-typecard-name">{t === "loose_stone" ? "Loose stone" : "Jewellery"}</div>
                <div className="cat-typecard-sub">
                  {t === "loose_stone"
                    ? "Single unmounted stones — carat, cut, shape, clarity, origin & lab cert."
                    : "Finished pieces — metal, setting, and one or more component gemstones."}
                </div>
              </div>
              <span className="cat-typecard-chk" />
            </div>
          ))}
        </div>
        <div className="cat-imageup-tip" style={{ marginTop: 12 }}>
          <svg className="cat-imageup-tip-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="8" r="6.5" /><path d="M8 5v3.5M8 11v.01" />
          </svg>
          Changing the type re-shapes which fields appear on every product in this category.
        </div>
      </div>
    </section>
  )

  const imageSection = (
    <section className="pd-sec">
      <div className="pd-sec-head">
        <div className="pd-sec-icon" data-tone="amber">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
          </svg>
        </div>
        <div>
          <div className="pd-sec-title">Cover image</div>
          <div className="pd-sec-sub">Square image used on the category card &amp; landing hero</div>
        </div>
        {imageUrl && (
          <div className="pd-sec-tools">
            <button className="pd-btn" type="button" onClick={() => { setImageUrl(""); mark() }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
              </svg>
              Remove
            </button>
          </div>
        )}
      </div>
      <div className="pd-sec-body">
        <div className="cat-imageup">
          {imageUrl ? (
            <div style={{ position: "relative", width: 152, height: 152, borderRadius: 12, overflow: "hidden", border: "1px solid var(--lv-border)", flexShrink: 0 }}>
              <Image src={imageUrl} alt="" fill className="object-cover" sizes="152px" />
            </div>
          ) : (
            <label className="cat-imageup-drop" style={{ cursor: uploadingImage ? "not-allowed" : "pointer", opacity: uploadingImage ? 0.6 : 1 }}>
              <svg className="cat-imageup-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 16V4M12 4l-4 4M12 4l4 4" /><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
              </svg>
              <span className="cat-imageup-drop-l">{uploadingImage ? "Uploading…" : "Click or drop image"}</span>
              <span className="cat-imageup-drop-s">PNG / JPG / WebP · max {MAX_IMAGE_SIZE_MB} MB</span>
              <input type="file" accept={ALLOWED_IMAGE_TYPES.join(",")} className="sr-only" disabled={uploadingImage} onChange={handleImageChange} />
            </label>
          )}
          <div className="cat-imageup-info">
            <div className="cat-imageup-tip">
              <svg className="cat-imageup-tip-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="8" cy="8" r="6.5" /><path d="M8 11v-3M8 5.5v.01" />
              </svg>
              Use a clean macro shot of a representative stone or piece. Square crop, transparent or off-white background.
            </div>
            <div className="cat-imageup-tip">
              <svg className="cat-imageup-tip-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 8a6 6 0 1 1 12 0 6 6 0 0 1-12 0z" /><path d="m6 8 1.5 1.5L10 7" />
              </svg>
              If no image is uploaded, the system shows the short code on a tinted tile.
            </div>
            {imageUploadError && <p style={{ fontSize: 12, color: "#B91C1C", margin: 0 }}>{imageUploadError}</p>}
            <div className="cat-imageup-actions">
              <label className="pd-btn" style={{ cursor: uploadingImage ? "not-allowed" : "pointer", opacity: uploadingImage ? 0.6 : 1 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                {imageUrl ? "Replace image" : "Upload image"}
                <input type="file" accept={ALLOWED_IMAGE_TYPES.join(",")} className="sr-only" disabled={uploadingImage} onChange={handleImageChange} />
              </label>
            </div>
          </div>
        </div>
      </div>
    </section>
  )

  /* ── EDIT mode — enterprise layout ── */
  if (isEdit && category) {
    return (
      <div>
        <div className="pd-stickybar">
          {/* Top bar */}
          <div className="pd-topbar">
            <nav className="pd-breadcrumbs" aria-label="Breadcrumb">
              <Link href="/admin/categories">Categories</Link>
              <ChevronRight size={11} style={{ opacity: 0.5 }} />
              <span className="pd-here">{name}</span>
            </nav>

            {(prevHref != null || nextHref != null || listPosition != null) && (
              <div className="pd-listnav">
                {prevHref ? (
                  <Link href={prevHref} className="pd-listnav-btn" aria-label="Previous category">
                    <ChevronLeft size={14} />
                  </Link>
                ) : (
                  <span className="pd-listnav-btn" style={{ opacity: 0.25 }} aria-hidden="true">
                    <ChevronLeft size={14} />
                  </span>
                )}
                {listPosition != null && listTotal != null && (
                  <span className="pd-listnav-count">{listPosition} / {listTotal}</span>
                )}
                {nextHref ? (
                  <Link href={nextHref} className="pd-listnav-btn" aria-label="Next category">
                    <ChevronRight size={14} />
                  </Link>
                ) : (
                  <span className="pd-listnav-btn" style={{ opacity: 0.25 }} aria-hidden="true">
                    <ChevronRight size={14} />
                  </span>
                )}
              </div>
            )}

            <div className="pd-topbar-spacer" />

            <Link href="/admin/categories/new" className="pd-btn">
              <Plus size={13} /> New category
            </Link>
          </div>

          {/* Sticky save bar */}
          <div className="pd-savebar">
            {dirty
              ? <span className="pd-savebar-dirty"><span className="pd-savebar-dirty-dot" /> Unsaved changes</span>
              : <span style={{ fontSize: 12, color: "var(--lv-text-3)" }}>Saved · {fmtRelative(category.updatedAt)}</span>}
            <span style={{ flex: 1 }} />
            <Link href="/admin/categories" className="pd-btn">Cancel</Link>
            <button className="pd-btn pd-btn-primary" onClick={handleSave} disabled={loading}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17,21 17,13 7,13 7,21" /><polyline points="7,3 7,8 15,8" />
              </svg>
              {loading ? "Saving…" : "Update category"}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ background: "#FEF2F2", border: "1px solid rgba(185,28,28,0.2)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#B91C1C" }}>
            {error}
          </div>
        )}

        <div className="pd-grid">
          {/* MAIN column */}
          <div className="pd-main">
            {/* Hero head card */}
            <div className="cat-headcard" style={{ "--hue": "220" } as React.CSSProperties}>
              <div className="cat-head-row">
                <div
                  className={"cat-thumb xl" + (!imageUrl ? " empty" : "")}
                  style={imageUrl ? { background: "none", overflow: "hidden" } : undefined}
                >
                  {imageUrl ? (
                    <Image src={imageUrl} alt="" fill className="object-cover" sizes="88px" />
                  ) : (
                    <span className="cat-thumb-glyph">{initials}</span>
                  )}
                </div>
                <div className="cat-head-text">
                  <div className="cat-head-eyebrow">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                    Catalog · {type === "loose_stone" ? "Loose stone" : "Jewellery"} · {shortCode}
                  </div>
                  <h1 className="cat-head-h">{name || "Unnamed category"}</h1>
                  <div className="cat-head-pills">
                    <span className="cat-head-pill active"><span className="cat-pill-dot" />Active</span>
                    <TypePill type={type} />
                    {shortCode && <span className="cat-head-pill">{shortCode}</span>}
                  </div>
                </div>
              </div>
            </div>

            {identitySection}
            {imageSection}
            {classificationSection}
          </div>

          {/* SIDEBAR */}
          <div className="pd-side">
            {/* Status */}
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
                    <TypePill type={type} />
                  </div>
                  <div className="pd-kv">
                    <span className="pd-kv-label">Short code</span>
                    <span className="cat-code">{shortCode || "—"}</span>
                  </div>
                  <div className="pd-kv">
                    <span className="pd-kv-label">Slug</span>
                    <span style={{ fontSize: 11.5, fontFamily: "var(--font-mono, monospace)", color: "var(--lv-text-3)" }}>{slug || "—"}</span>
                  </div>
                  <div className="pd-kv">
                    <span className="pd-kv-label">Created</span>
                    <span style={{ fontSize: 12, color: "var(--lv-text-2)" }}>{fmtDate(category.createdAt)}</span>
                  </div>
                  <div className="pd-kv">
                    <span className="pd-kv-label">Updated</span>
                    <span style={{ fontSize: 12, color: "var(--lv-text-2)" }}>{fmtRelative(category.updatedAt)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Danger zone */}
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
                      Delete <strong>{category.name}</strong>? Products using this category will have their category cleared.
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
      <div className="pd-stickybar">
        <div className="pd-topbar">
          <nav className="pd-breadcrumbs" aria-label="Breadcrumb">
            <Link href="/admin/categories">Categories</Link>
            <ChevronRight size={11} style={{ opacity: 0.5 }} />
            <span className="pd-here">New category</span>
          </nav>
        </div>

        {/* Sticky save bar — matches edit mode */}
        <div className="pd-savebar">
          <span style={{ fontSize: 12, color: "var(--lv-text-3)" }}>New category</span>
          <span style={{ flex: 1 }} />
          <Link href="/admin/categories" className="pd-btn">Discard</Link>
          <button className="pd-btn pd-btn-primary" onClick={handleSave} disabled={loading}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17,21 17,13 7,13 7,21" /><polyline points="7,3 7,8 15,8" />
            </svg>
            {loading ? "Creating…" : "Create category"}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid rgba(185,28,28,0.2)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#B91C1C" }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {identitySection}
        {classificationSection}
        {imageSection}
      </div>
    </div>
  )
}
