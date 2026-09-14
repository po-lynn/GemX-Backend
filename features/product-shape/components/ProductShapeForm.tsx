"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  createProductShapeAction,
  updateProductShapeAction,
  deleteProductShapeAction,
} from "@/features/product-shape/actions/product-shape"
import type { ProductShapeForEdit } from "@/features/product-shape/db/product-shape"

function fmtDate(d: Date | null | undefined) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function fmtRelative(d: Date | null | undefined) {
  if (!d) return "—"
  const diff = (Date.now() - new Date(d).getTime()) / 1000
  if (diff < 60) return "just now"
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return fmtDate(d)
}

function shapeHue(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 47 + s.charCodeAt(i)) & 0xffff
  return (h % 200) + 160
}

function ChevronRight() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path
        d="M4 2l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

type Props = {
  mode: "create" | "edit"
  productShape?: ProductShapeForEdit | null
}

export function ProductShapeForm({ mode, productShape }: Props) {
  const router = useRouter()
  const isEdit = mode === "edit"

  const [name, setName] = useState(productShape?.name ?? "")
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function mark() {
    setDirty(true)
  }

  async function handleSave(e?: React.SyntheticEvent) {
    e?.preventDefault()
    if (!name.trim()) {
      setError("Product Shape is required.")
      return
    }
    setError(null)
    setLoading(true)
    const fd = new FormData()
    if (isEdit && productShape) fd.set("productShapeId", productShape.id)
    fd.set("name", name.trim())
    const result = isEdit
      ? await updateProductShapeAction(fd)
      : await createProductShapeAction(fd)
    setLoading(false)
    if (result?.error) {
      setError(result.error)
      return
    }
    toast.success(isEdit ? "Product shape updated" : "Product shape created")
    setDirty(false)
    if (!isEdit) router.push("/admin/product-shape")
  }

  async function handleDelete() {
    if (!productShape) return
    setDeleting(true)
    const fd = new FormData()
    fd.set("productShapeId", productShape.id)
    const result = await deleteProductShapeAction(fd)
    if (result?.error) {
      toast.error(result.error)
      setDeleting(false)
      return
    }
    toast.success("Product shape deleted")
    router.push("/admin/product-shape")
  }

  const displayName = name || (isEdit ? productShape?.name : "") || "New product shape"
  const initials =
    name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "SH"
  const hue = shapeHue(name || "Shape")

  const nameSection = (
    <section className="pd-sec">
      <div className="pd-sec-head">
        <div className="pd-sec-icon" data-tone="blue">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8.3 10a.7.7 0 0 1-.626-1.079L11.4 3a.7.7 0 0 1 1.198-.043L16.3 8.9a.7.7 0 0 1-.572 1.1Z" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <circle cx="17.5" cy="17.5" r="3.5" />
          </svg>
        </div>
        <div>
          <div className="pd-sec-title">Shape</div>
          <div className="pd-sec-sub">
            Name used on product listings and filters
          </div>
        </div>
      </div>
      <div className="pd-sec-body">
        <div className="pd-field">
          <label className="pd-label">
            Product Shape <span style={{ color: "#DC2626" }}>*</span>
            <span className="pd-label-hint">e.g. Oval, Round, Pear</span>
          </label>
          <input
            className="pd-input"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              mark()
            }}
            maxLength={200}
            required
            placeholder="e.g. Oval"
          />
        </div>
      </div>
    </section>
  )

  if (isEdit && productShape) {
    return (
      <div>
        <div className="pd-topbar">
          <div className="pd-breadcrumbs">
            <Link href="/admin/product-shape">Product Shape</Link>
            <ChevronRight />
            <span className="pd-here">{displayName}</span>
          </div>
        </div>

        <div className="pd-savebar" style={{ top: 0 }}>
          {dirty ? (
            <span className="pd-savebar-dirty">
              <span className="pd-savebar-dirty-dot" /> Unsaved changes
            </span>
          ) : (
            <span style={{ fontSize: 12, color: "var(--lv-text-3)" }}>
              Saved · {fmtRelative(productShape.updatedAt)}
            </span>
          )}
          <span style={{ flex: 1 }} />
          <Link href="/admin/product-shape" className="pd-btn">
            Cancel
          </Link>
          <button
            className="pd-btn pd-btn-primary"
            onClick={handleSave}
            disabled={loading || !name.trim()}
          >
            {loading ? "Saving…" : "Update shape"}
          </button>
        </div>

        {error && (
          <div
            style={{
              background: "#FEF2F2",
              border: "1px solid rgba(185,28,28,0.2)",
              borderRadius: 8,
              padding: "10px 14px",
              marginBottom: 16,
              fontSize: 13,
              color: "#B91C1C",
            }}
          >
            {error}
          </div>
        )}

        <div className="pd-grid">
          <div className="pd-main">
            <div className="ori-headcard">
              <div className="ori-head-row">
                <span
                  className="ori-avatar xl"
                  style={{ "--hue": hue } as React.CSSProperties}
                >
                  <span className="ori-avatar-glyph">{initials}</span>
                </span>
                <div className="ori-head-text">
                  <div
                    className="cat-head-eyebrow"
                    style={{ "--hue": String(hue) } as React.CSSProperties}
                  >
                    Product shape
                  </div>
                  <h1 className="cat-head-h">
                    {name || productShape.name || "Unnamed shape"}
                  </h1>
                </div>
              </div>
            </div>
            {nameSection}
          </div>

          <div className="pd-side">
            <div className="pd-sidecard">
              <div className="pd-sidecard-head">
                <div className="pd-sidecard-icon">
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4M12 8h.01" />
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
                    <span className="pd-kv-label">Created</span>
                    <span style={{ fontSize: 12, color: "var(--lv-text-2)" }}>
                      {fmtDate(productShape.createdAt)}
                    </span>
                  </div>
                  <div className="pd-kv">
                    <span className="pd-kv-label">Updated</span>
                    <span style={{ fontSize: 12, color: "var(--lv-text-2)" }}>
                      {fmtRelative(productShape.updatedAt)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pd-sidecard">
              <div className="pd-sidecard-head">
                <div
                  className="pd-sidecard-icon"
                  style={{ background: "#FEF2F2", color: "#B91C1C" }}
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                  </svg>
                </div>
                <div>
                  <div className="pd-sidecard-title">Danger zone</div>
                  <div className="pd-sidecard-sub">Irreversible actions</div>
                </div>
              </div>
              <div
                className="pd-sidecard-body"
                style={{ display: "flex", flexDirection: "column", gap: 8 }}
              >
                {!showDeleteConfirm ? (
                  <button
                    className="pd-btn"
                    style={{
                      color: "#B91C1C",
                      borderColor: "rgba(185,28,28,0.25)",
                      justifyContent: "center",
                    }}
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    Delete permanently
                  </button>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <p
                      style={{
                        fontSize: 12,
                        color: "var(--lv-text-2)",
                        lineHeight: 1.5,
                        margin: 0,
                      }}
                    >
                      Delete <strong>{productShape.name}</strong>? Existing
                      products keep their stored shape text.
                    </p>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        className="pd-btn"
                        style={{
                          background: "#B91C1C",
                          color: "#fff",
                          borderColor: "transparent",
                          flex: 1,
                          justifyContent: "center",
                        }}
                        onClick={handleDelete}
                        disabled={deleting}
                      >
                        {deleting ? "Deleting…" : "Confirm delete"}
                      </button>
                      <button
                        className="pd-btn"
                        onClick={() => setShowDeleteConfirm(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
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
          <Link href="/admin/product-shape">Product Shape</Link>
          <ChevronRight />
          <span className="pd-here">New product shape</span>
        </div>
      </div>

      <div className="pd-savebar" style={{ top: 0 }}>
        <span style={{ fontSize: 12, color: "var(--lv-text-3)" }}>
          New product shape
        </span>
        <span style={{ flex: 1 }} />
        <Link href="/admin/product-shape" className="pd-btn">
          Discard
        </Link>
        <button
          className="pd-btn pd-btn-primary"
          onClick={handleSave}
          disabled={loading || !name.trim()}
        >
          {loading ? "Creating…" : "Create shape"}
        </button>
      </div>

      {error && (
        <div
          style={{
            background: "#FEF2F2",
            border: "1px solid rgba(185,28,28,0.2)",
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 16,
            fontSize: 13,
            color: "#B91C1C",
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {nameSection}
      </div>
    </div>
  )
}
