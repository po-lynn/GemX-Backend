"use client"

import Link from "next/link"
import { useState, useCallback, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { createPortalProductAction, updatePortalProductAction } from "@/features/products/actions/portal-products"
import { PRODUCT_IDENTIFICATION_OPTIONS } from "@/features/products/schemas/products"
import { toast } from "sonner"
import {
  Award,
  BadgeDollarSign,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Gem,
  Layers,
  Package,
  Pencil,
  Play,
  Plus,
  Save,
  Sparkles,
  StickyNote,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react"
import type { CategoryRow } from "@/features/categories/db/categories"
import type { LaboratoryOption } from "@/features/laboratory/db/laboratory"

const MAX_PRODUCT_IMAGES = 10
const MAX_PRODUCT_VIDEOS = 5

const SHAPES = ["Oval", "Cushion", "Round", "Pear", "Heart"] as const

// ── Helpers ───────────────────────────────────────────────────────────

function getGemHue(categoryName?: string | null): number {
  const n = (categoryName ?? "").toLowerCase()
  if (n.includes("ruby") || n.includes("garnet") || n.includes("spinel")) return 0
  if (n.includes("sapphire")) return 220
  if (n.includes("emerald")) return 140
  if (n.includes("amethyst")) return 270
  if (n.includes("topaz") || n.includes("citrine")) return 40
  if (n.includes("aqua") || n.includes("aquamarine")) return 195
  if (n.includes("tourmaline") || n.includes("jade")) return 150
  if (n.includes("diamond")) return 210
  if (n.includes("pearl")) return 200
  return 260
}

function parseDimensions(value: string | null | undefined): [string, string, string] {
  if (!value?.trim()) return ["", "", ""]
  const parts = value.trim().split(/\s*[x×]\s*/i).map((s) => s.trim())
  return [parts[0] ?? "", parts[1] ?? "", parts[2] ?? ""]
}

function isPdfUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase()
    return path.endsWith(".pdf")
  } catch {
    return url.toLowerCase().includes(".pdf")
  }
}

// ── Sub-components ────────────────────────────────────────────────────

function CertificateViewer({ url, onRemove }: { url: string; onRemove: () => void }) {
  const isPdf = isPdfUrl(url)
  return (
    <div className="pd-cert">
      <div className="pd-cert-ico"><FileText size={18} /></div>
      <div className="pd-cert-meta">
        <div className="pd-cert-name">Certificate {isPdf ? "(PDF)" : "(image)"}</div>
        <div className="pd-cert-sub">{isPdf ? "PDF document" : "Image file"} · uploaded</div>
      </div>
      <button
        type="button"
        className="pd-btn"
        onClick={() => window.open(url, "_blank")}
        aria-label="View certificate"
      >
        <Eye size={13} /> View
      </button>
      <button
        type="button"
        className="pd-btn"
        onClick={onRemove}
        aria-label="Remove certificate"
      >
        <X size={13} /> Remove
      </button>
    </div>
  )
}

function ImageViewer({
  images,
  initialIndex,
  onClose,
}: {
  images: string[]
  initialIndex: number
  onClose: () => void
}) {
  const [idx, setIdx] = useState(initialIndex)
  const closeRef = useRef<HTMLButtonElement>(null)
  const stripRef = useRef<HTMLDivElement>(null)

  const prev = useCallback(() => setIdx((i) => Math.max(0, i - 1)), [])
  const next = useCallback(() => setIdx((i) => Math.min(images.length - 1, i + 1)), [images.length])

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  useEffect(() => {
    const el = stripRef.current?.children[idx] as HTMLElement | undefined
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" })
  }, [idx])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowLeft") prev()
      if (e.key === "ArrowRight") next()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose, prev, next])

  return (
    <div
      className="pd-viewer"
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <button ref={closeRef} className="pd-viewer-close" onClick={onClose} aria-label="Close viewer">
        <X size={18} />
      </button>
      <span className="pd-viewer-counter">{idx + 1} / {images.length}</span>

      <div className="pd-viewer-stage">
        <button
          className="pd-viewer-nav prev"
          onClick={prev}
          disabled={idx === 0}
          aria-label="Previous image"
        >
          <ChevronLeft size={20} />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={images[idx]}
          className="pd-viewer-img"
          src={images[idx]}
          alt={`Product image ${idx + 1} of ${images.length}`}
        />
        <button
          className="pd-viewer-nav next"
          onClick={next}
          disabled={idx === images.length - 1}
          aria-label="Next image"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div ref={stripRef} className="pd-viewer-strip" role="list" aria-label="All images">
        {images.map((url, i) => (
          <button
            key={url}
            role="listitem"
            className={`pd-viewer-strip-thumb${i === idx ? " active" : ""}`}
            onClick={() => setIdx(i)}
            aria-label={`View image ${i + 1}`}
            aria-current={i === idx ? "true" : undefined}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" />
          </button>
        ))}
      </div>
    </div>
  )
}

function VideoViewer({
  videos,
  initialIndex,
  onClose,
}: {
  videos: string[]
  initialIndex: number
  onClose: () => void
}) {
  const [idx, setIdx] = useState(initialIndex)
  const closeRef = useRef<HTMLButtonElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const prev = useCallback(() => setIdx((i) => Math.max(0, i - 1)), [])
  const next = useCallback(() => setIdx((i) => Math.min(videos.length - 1, i + 1)), [videos.length])

  useEffect(() => { closeRef.current?.focus() }, [])

  useEffect(() => {
    videoRef.current?.load()
    videoRef.current?.play().catch(() => {})
  }, [idx])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowLeft") prev()
      if (e.key === "ArrowRight") next()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose, prev, next])

  return (
    <div
      className="pd-viewer"
      role="dialog"
      aria-modal="true"
      aria-label="Video viewer"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <button ref={closeRef} className="pd-viewer-close" onClick={onClose} aria-label="Close viewer">
        <X size={18} />
      </button>
      <span className="pd-viewer-counter">Video {idx + 1} / {videos.length}</span>

      <div className="pd-viewer-stage">
        {videos.length > 1 && (
          <button className="pd-viewer-nav prev" onClick={prev} disabled={idx === 0} aria-label="Previous video">
            <ChevronLeft size={20} />
          </button>
        )}
        <video
          key={videos[idx]}
          ref={videoRef}
          className="pd-viewer-video"
          src={videos[idx]}
          controls
          playsInline
          preload="metadata"
        />
        {videos.length > 1 && (
          <button className="pd-viewer-nav next" onClick={next} disabled={idx === videos.length - 1} aria-label="Next video">
            <ChevronRight size={20} />
          </button>
        )}
      </div>

      {videos.length > 1 && (
        <div className="pd-viewer-strip" role="list" aria-label="All videos">
          {videos.map((_, i) => (
            <button
              key={i}
              role="listitem"
              className={`pd-viewer-strip-thumb pd-viewer-strip-video${i === idx ? " active" : ""}`}
              onClick={() => setIdx(i)}
              aria-label={`Video ${i + 1}`}
              aria-current={i === idx ? "true" : undefined}
            >
              <Play size={16} />
              <span>{i + 1}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Types ─────────────────────────────────────────────────────────────

type FormGemstoneEntry = {
  categoryId: string
  weightCarat: string
  pieceCount: string
  dimensions: string
  color: string
  shape: string
  origin: string
  cut: string
  transparency: string
  comment: string
  inclusions: string
}

type Props = {
  mode: "create" | "edit"
  categories: CategoryRow[]
  laboratories: LaboratoryOption[]
  productId?: string
  initial?: {
    title?: string
    description?: string
    productType?: "loose_stone" | "jewellery"
    categoryId?: string
    price?: string
    currency?: string
    isNegotiable?: boolean
    identification?: string
    isFeatured?: boolean
    isCollectorPiece?: boolean
    isPrivilegeAssist?: boolean
    isPromotion?: boolean
    weightCarat?: string
    color?: string
    origin?: string
    stoneCut?: string
    shape?: string
    metal?: string
    totalWeightGrams?: string
    pieceCount?: string
    dimensions?: string
    laboratoryId?: string
    certReportNumber?: string
    certReportDate?: string
    certReportUrl?: string
    additionalMemos?: string
    imageUrls?: string[]
    videoUrls?: string[]
    jewelleryGemstones?: Array<{
      categoryId: string
      weightCarat: string
      pieceCount?: string
      dimensions?: string
      color?: string
      shape?: string
      origin?: string
      cut?: string
      transparency?: string
      comment?: string
      inclusions?: string
    }>
  }
  backHref?: string
}

// ── Component ─────────────────────────────────────────────────────────

export default function PortalProductForm({
  mode,
  categories,
  laboratories,
  productId,
  initial,
  backHref,
}: Props) {
  const router = useRouter()
  const isEdit = mode === "edit"

  const [loading, setLoading] = useState(false)
  const [dirty, setDirty] = useState(false)

  const [productType, setProductType] = useState<"loose_stone" | "jewellery">(
    initial?.productType ?? "loose_stone"
  )
  const [isFeatured, setIsFeatured] = useState(initial?.isFeatured ?? false)
  const [isCollectorPiece, setIsCollectorPiece] = useState(initial?.isCollectorPiece ?? false)
  const [isPrivilegeAssist, setIsPrivilegeAssist] = useState(initial?.isPrivilegeAssist ?? false)
  const [isPromotion, setIsPromotion] = useState(initial?.isPromotion ?? false)
  const [isNegotiable, setIsNegotiable] = useState(initial?.isNegotiable ?? false)

  const [imageUrlsList, setImageUrlsList] = useState<string[]>(initial?.imageUrls ?? [])
  const [videoUrlsList, setVideoUrlsList] = useState<string[]>(initial?.videoUrls ?? [])
  const [uploadingImages, setUploadingImages] = useState(false)
  const [uploadingVideos, setUploadingVideos] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadFileCount, setUploadFileCount] = useState(0)
  const [uploadMediaType, setUploadMediaType] = useState<"image" | "video">("image")
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [viewerIdx, setViewerIdx] = useState<number | null>(null)
  const [videoViewerIdx, setVideoViewerIdx] = useState<number | null>(null)
  const [certReportUrl, setCertReportUrl] = useState(initial?.certReportUrl ?? "")
  const [uploadingCertificate, setUploadingCertificate] = useState(false)

  const [notesTab, setNotesTab] = useState<"description" | "extra">("description")

  const [dimensionsPart1, setDimensionsPart1] = useState(() => parseDimensions(initial?.dimensions)[0])
  const [dimensionsPart2, setDimensionsPart2] = useState(() => parseDimensions(initial?.dimensions)[1])
  const [dimensionsPart3, setDimensionsPart3] = useState(() => parseDimensions(initial?.dimensions)[2])

  // ── Gemstone dialog state ──
  const emptyGemstone = (): FormGemstoneEntry => ({
    categoryId: "", weightCarat: "", pieceCount: "", dimensions: "",
    color: "", shape: "", origin: "", cut: "", transparency: "", comment: "", inclusions: "",
  })
  const [jewelleryGemstones, setJewelleryGemstones] = useState<FormGemstoneEntry[]>(
    (initial?.jewelleryGemstones ?? []).map((g) => ({
      categoryId: g.categoryId,
      weightCarat: g.weightCarat,
      pieceCount: g.pieceCount ?? "",
      dimensions: g.dimensions ?? "",
      color: g.color ?? "",
      shape: g.shape ?? "",
      origin: g.origin ?? "",
      cut: g.cut ?? "",
      transparency: g.transparency ?? "",
      comment: g.comment ?? "",
      inclusions: g.inclusions ?? "",
    }))
  )
  const [gemstoneDialogOpen, setGemstoneDialogOpen] = useState(false)
  const [gemstoneDialogMode, setGemstoneDialogMode] = useState<"add" | "edit" | "view">("add")
  const [gemstoneDialogIndex, setGemstoneDialogIndex] = useState<number | null>(null)
  const [gemstoneDialogForm, setGemstoneDialogForm] = useState<FormGemstoneEntry>(emptyGemstone)

  const categoryOptions = categories.filter((c) => c.type === productType)
  const stoneOptions = categories.filter((c) => c.type === "loose_stone")
  const currentCategory = categories.find((c) => c.id === initial?.categoryId)
  const gemHue = getGemHue(currentCategory?.name)

  // ── Gemstone handlers ──
  function openAddGemstoneDialog() {
    setGemstoneDialogForm(emptyGemstone())
    setGemstoneDialogMode("add")
    setGemstoneDialogIndex(null)
    setGemstoneDialogOpen(true)
  }
  function openEditGemstoneDialog(index: number) {
    setGemstoneDialogForm({ ...jewelleryGemstones[index] })
    setGemstoneDialogMode("edit")
    setGemstoneDialogIndex(index)
    setGemstoneDialogOpen(true)
  }
  function openViewGemstoneDialog(index: number) {
    setGemstoneDialogForm({ ...jewelleryGemstones[index] })
    setGemstoneDialogMode("view")
    setGemstoneDialogIndex(null)
    setGemstoneDialogOpen(true)
  }
  function handleSaveGemstoneDialog() {
    if (gemstoneDialogMode === "add") {
      setJewelleryGemstones((prev) => [...prev, { ...gemstoneDialogForm }])
    } else if (gemstoneDialogMode === "edit" && gemstoneDialogIndex !== null) {
      setJewelleryGemstones((prev) =>
        prev.map((r, i) => (i === gemstoneDialogIndex ? { ...gemstoneDialogForm } : r))
      )
    }
    setGemstoneDialogOpen(false)
    setDirty(true)
  }
  function handleRemoveGemstone(index: number) {
    setJewelleryGemstones((prev) => prev.filter((_, i) => i !== index))
    setDirty(true)
  }

  // ── Media upload ──
  function handleUploadMedia(type: "image" | "video", files: FileList | null) {
    if (!files?.length) return
    setUploadError(null)
    const maxCount = type === "image" ? MAX_PRODUCT_IMAGES : MAX_PRODUCT_VIDEOS
    const currentList = type === "image" ? imageUrlsList : videoUrlsList
    const currentCount = currentList.length
    if (currentCount >= maxCount) {
      setUploadError(`Maximum ${maxCount} ${type}s. You have ${currentCount}.`)
      return
    }
    const slotsLeft = maxCount - currentCount
    if (files.length > slotsLeft) {
      setUploadError(`Maximum ${maxCount} ${type}s. Add up to ${slotsLeft} more.`)
      return
    }
    setUploadProgress(0)
    setUploadFileCount(files.length)
    setUploadMediaType(type)
    if (type === "image") setUploadingImages(true)
    else setUploadingVideos(true)
    const formData = new FormData()
    formData.set("type", type)
    for (let i = 0; i < files.length; i++) formData.append("files", files[i])
    const xhr = new XMLHttpRequest()
    xhr.open("POST", "/api/upload/product-media")
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100))
    })
    xhr.addEventListener("load", () => {
      try {
        const data = JSON.parse(xhr.responseText || "{}")
        if (xhr.status >= 200 && xhr.status < 300) {
          const urls = (data.urls as string[]) ?? []
          if (type === "image") setImageUrlsList((prev) => [...prev, ...urls].slice(0, MAX_PRODUCT_IMAGES))
          else setVideoUrlsList((prev) => [...prev, ...urls].slice(0, MAX_PRODUCT_VIDEOS))
          setDirty(true)
        } else {
          setUploadError(data.error || `Upload failed (${xhr.status})`)
        }
      } catch {
        setUploadError("Upload failed")
      } finally {
        setUploadingImages(false)
        setUploadingVideos(false)
        setUploadProgress(0)
      }
    })
    xhr.addEventListener("error", () => {
      setUploadError("Upload failed")
      setUploadingImages(false)
      setUploadingVideos(false)
      setUploadProgress(0)
    })
    xhr.addEventListener("abort", () => {
      setUploadingImages(false)
      setUploadingVideos(false)
      setUploadProgress(0)
    })
    xhr.send(formData)
  }

  function handleUploadCertificate(files: FileList | null) {
    if (!files?.length) return
    setUploadError(null)
    setUploadingCertificate(true)
    const formData = new FormData()
    formData.set("file", files[0])
    const xhr = new XMLHttpRequest()
    xhr.open("POST", "/api/upload/certificate")
    xhr.addEventListener("load", () => {
      try {
        const data = JSON.parse(xhr.responseText || "{}")
        if (xhr.status >= 200 && xhr.status < 300 && data.url) {
          setCertReportUrl(data.url)
          setDirty(true)
        } else {
          setUploadError(data.error || `Upload failed (${xhr.status})`)
        }
      } catch {
        setUploadError("Upload failed")
      } finally {
        setUploadingCertificate(false)
      }
    })
    xhr.addEventListener("error", () => { setUploadError("Upload failed"); setUploadingCertificate(false) })
    xhr.addEventListener("abort", () => setUploadingCertificate(false))
    xhr.send(formData)
  }

  // ── Submit ──
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const form = e.currentTarget
    const fd = new FormData(form)

    const input: Record<string, unknown> = {
      title: fd.get("title") as string,
      description: fd.get("description") as string,
      productType,
      categoryId: fd.get("categoryId") as string,
      price: fd.get("price") as string,
      currency: fd.get("currency") as string,
      isNegotiable,
      identification: fd.get("identification") as string,
      isFeatured,
      isCollectorPiece,
      isPrivilegeAssist,
      isPromotion,
      weightCarat: fd.get("weightCarat") as string,
      color: fd.get("color") as string,
      origin: fd.get("origin") as string,
      stoneCut: fd.get("stoneCut") as string,
      shape: fd.get("shape") as string,
      metal: fd.get("metal") as string,
      totalWeightGrams: fd.get("totalWeightGrams") as string,
      pieceCount: fd.get("pieceCount") as string,
      dimensions: [dimensionsPart1, dimensionsPart2, dimensionsPart3].filter(Boolean).join(" × "),
      laboratoryId: fd.get("laboratoryId") as string,
      certReportNumber: fd.get("certReportNumber") as string,
      certReportDate: fd.get("certReportDate") as string,
      certReportUrl,
      additionalMemos: fd.get("additionalMemos") as string,
      imageUrls: imageUrlsList,
      videoUrls: videoUrlsList,
    }

    if (productType === "jewellery") {
      input.jewelleryGemstones = jewelleryGemstones
        .filter((g) => g.categoryId && g.weightCarat.trim() !== "")
        .map((g) => ({
          categoryId: g.categoryId,
          weightCarat: g.weightCarat,
          pieceCount: g.pieceCount.trim() ? Number(g.pieceCount) : undefined,
          dimensions: g.dimensions.trim() || null,
          color: g.color.trim() || null,
          shape: g.shape || null,
          origin: g.origin.trim() || null,
          cut: g.cut.trim() || null,
          transparency: g.transparency.trim() || null,
          comment: g.comment.trim() || null,
          inclusions: g.inclusions.trim() || null,
        }))
    }

    try {
      const result = isEdit
        ? await updatePortalProductAction(productId!, input)
        : await createPortalProductAction(input)

      if (!result.ok) {
        toast.error("Failed to save product", { description: result.error })
        setLoading(false)
        return
      }

      setDirty(false)
      toast.success(isEdit ? "Changes saved" : "Product created", {
        description: isEdit
          ? "The product listing has been updated."
          : "The new listing is now pending review.",
      })
      router.push("/portal/products")
      router.refresh()
    } catch {
      toast.error("Failed to save product", {
        description: "An unexpected error occurred. Please try again.",
      })
    } finally {
      setLoading(false)
    }
  }

  // ── Render ──
  return (
    <div className="pd-host" style={{ marginTop: "-32px" }}>
      {/* ─── Sticky bar ──────────────────────────────────────────────── */}
      <div className="pd-stickybar" style={{ top: "56px", background: "var(--background)", boxShadow: "0 -28px 0 0 var(--background)", paddingTop: "12px" }}>
        <div className="pd-topbar">
          <nav className="pd-breadcrumbs" aria-label="Breadcrumb">
            {backHref && (
              <>
                <Link href={backHref} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  ← Back
                </Link>
                <ChevronRight size={11} style={{ opacity: 0.5 }} />
              </>
            )}
            <Link href="/portal/products">My products</Link>
            <ChevronRight size={11} style={{ opacity: 0.5 }} />
            <span className="pd-here">
              {isEdit ? (initial?.title || "Edit product") : "New product"}
            </span>
          </nav>
          <div className="pd-topbar-spacer" />
          {isEdit && (
            <Link href="/portal/products/new" className="pd-btn">
              <Plus size={13} /> New product
            </Link>
          )}
        </div>

        <div className="pd-savebar">
          {dirty ? (
            <span className="pd-savebar-dirty">
              <span className="pd-savebar-dirty-dot" />
              Unsaved changes
            </span>
          ) : isEdit ? (
            <span style={{ fontSize: 12, color: "var(--lv-text-3)" }}>Saved</span>
          ) : null}
          <span style={{ flex: 1 }} />
          <Link href="/portal/products" className="pd-btn">Discard</Link>
          <button
            type="submit"
            form="portal-product-form"
            className="pd-btn pd-btn-primary"
            disabled={loading}
          >
            <Save size={13} />
            {loading ? "Saving…" : isEdit ? "Save changes" : "Create product"}
          </button>
        </div>
      </div>

      {/* ─── Single column form ───────────────────────────────────────── */}
      <form
        id="portal-product-form"
        className="pd-main"
        onSubmit={handleSubmit}
        onInput={() => setDirty(true)}
      >
        {/* ── Images & videos ── */}
        <section className="pd-sec">
          <div className="pd-sec-head">
            <div className="pd-sec-icon" data-tone="purple">
              <Upload size={16} />
            </div>
            <div>
              <div className="pd-sec-title">Images &amp; videos</div>
              <div className="pd-sec-sub">
                <strong>{imageUrlsList.length}</strong> images ·{" "}
                <strong>{videoUrlsList.length}</strong> videos · max {MAX_PRODUCT_IMAGES} images,{" "}
                {MAX_PRODUCT_VIDEOS} videos
              </div>
            </div>
            <div className="pd-sec-tools">
              <label
                className={`pd-btn${
                  uploadingImages || imageUrlsList.length >= MAX_PRODUCT_IMAGES ? " disabled" : ""
                }`}
                style={
                  uploadingImages || imageUrlsList.length >= MAX_PRODUCT_IMAGES
                    ? { opacity: 0.5, pointerEvents: "none" }
                    : {}
                }
              >
                <Upload size={13} /> Upload image
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  className="sr-only"
                  disabled={uploadingImages || imageUrlsList.length >= MAX_PRODUCT_IMAGES}
                  onChange={(e) => {
                    handleUploadMedia("image", e.target.files)
                    e.target.value = ""
                  }}
                />
              </label>
            </div>
          </div>
          <div className="pd-sec-body" style={{ gap: 10 }}>
            <div
              className="pd-media-strip"
              style={{ "--gem-hue": gemHue } as React.CSSProperties}
            >
              {imageUrlsList.map((url, idx) => (
                <div
                  key={`${url}-${idx}`}
                  className={`pd-media-thumb${idx === 0 ? " is-primary" : ""}`}
                >
                  <span className={`pd-media-badge${idx > 0 ? " muted" : ""}`}>
                    {idx === 0 ? "1 · Cover" : idx + 1}
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Product ${idx + 1}`}
                    onClick={() => setViewerIdx(idx)}
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      zIndex: 1,
                      cursor: "zoom-in",
                    }}
                  />
                  <div className="pd-media-actions">
                    <button type="button" title="View" onClick={() => setViewerIdx(idx)}>
                      <Eye size={11} />
                    </button>
                    <button
                      type="button"
                      title="Remove"
                      onClick={() => setImageUrlsList((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <X size={11} />
                    </button>
                  </div>
                </div>
              ))}
              {videoUrlsList.map((url, idx) => (
                <div key={`video-${url}-${idx}`} className="pd-media-thumb pd-media-thumb-video">
                  <span className="pd-media-badge muted">{idx + 1} · MP4</span>
                  <div className="pd-media-video-play" onClick={() => setVideoViewerIdx(idx)}>
                    <Play size={18} />
                  </div>
                  <div className="pd-media-actions">
                    <button type="button" title="Play" onClick={() => setVideoViewerIdx(idx)}>
                      <Play size={11} />
                    </button>
                    <button
                      type="button"
                      title="Remove"
                      onClick={() => setVideoUrlsList((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <X size={11} />
                    </button>
                  </div>
                </div>
              ))}

              {imageUrlsList.length < MAX_PRODUCT_IMAGES && (
                <label className="pd-media-add">
                  <Upload size={18} />
                  <span>Add image</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    className="sr-only"
                    disabled={uploadingImages || imageUrlsList.length >= MAX_PRODUCT_IMAGES}
                    onChange={(e) => {
                      handleUploadMedia("image", e.target.files)
                      e.target.value = ""
                    }}
                  />
                </label>
              )}
              {videoUrlsList.length < MAX_PRODUCT_VIDEOS && (
                <label className="pd-media-add video">
                  <Video size={18} />
                  <span>Add video</span>
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    multiple
                    className="sr-only"
                    disabled={uploadingVideos || videoUrlsList.length >= MAX_PRODUCT_VIDEOS}
                    onChange={(e) => {
                      handleUploadMedia("video", e.target.files)
                      e.target.value = ""
                    }}
                  />
                </label>
              )}
            </div>

            {/* Upload progress */}
            {(uploadingImages || uploadingVideos) && (
              <div className="pd-upload-card">
                <div className="pd-upload-card-head">
                  <div className="pd-upload-card-ico">
                    <Upload size={14} />
                  </div>
                  <div className="pd-upload-card-text">
                    <span className="pd-upload-card-label">
                      Uploading {uploadFileCount} {uploadMediaType}{uploadFileCount !== 1 ? "s" : ""}
                    </span>
                    <span className="pd-upload-card-sub">
                      Please wait, do not close this page
                    </span>
                  </div>
                  <span className="pd-upload-card-pct">{uploadProgress}%</span>
                </div>
                <div className="pd-upload-card-track">
                  <div className="pd-upload-card-fill" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}

            {uploadError && (
              <div className="pd-hint" style={{ color: "var(--lv-danger, #e53e3e)" }}>
                {uploadError}
              </div>
            )}

            <div className="pd-media-foot">
              <span>
                {imageUrlsList.length}/{MAX_PRODUCT_IMAGES} images ·{" "}
                {videoUrlsList.length}/{MAX_PRODUCT_VIDEOS} videos
              </span>
            </div>
          </div>
        </section>

        {/* ── Basic info ── */}
        <section className="pd-sec">
          <div className="pd-sec-head">
            <div className="pd-sec-icon" data-tone="blue">
              <Package size={16} />
            </div>
            <div>
              <div className="pd-sec-title">Basic info</div>
              <div className="pd-sec-sub">Core product identification and description</div>
            </div>
          </div>
          <div className="pd-sec-body">
            <div className="pd-field">
              <label htmlFor="title" className="pd-label">
                Title <span className="req">*</span>
              </label>
              <input
                id="title"
                name="title"
                type="text"
                required
                maxLength={200}
                defaultValue={initial?.title ?? ""}
                placeholder="Product title"
                className="pd-input"
              />
            </div>
            <div className="pd-row" style={{ "--cols": 2 } as React.CSSProperties}>
              <div className="pd-field">
                <label htmlFor="identification" className="pd-label">
                  Identification <span className="req">*</span>
                </label>
                <select
                  id="identification"
                  name="identification"
                  required
                  defaultValue={
                    initial?.identification &&
                    PRODUCT_IDENTIFICATION_OPTIONS.includes(
                      initial.identification as (typeof PRODUCT_IDENTIFICATION_OPTIONS)[number]
                    )
                      ? initial.identification
                      : "Natural"
                  }
                  className="pd-select"
                >
                  <option value="">Select…</option>
                  {PRODUCT_IDENTIFICATION_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="pd-field">
              <label htmlFor="productDescription" className="pd-label">
                Description{" "}
                <span className="pd-label-hint">Shown on the listing · max 5,000 chars</span>
              </label>
              <textarea
                id="productDescription"
                name="description"
                rows={4}
                maxLength={5000}
                defaultValue={initial?.description ?? ""}
                placeholder="Describe the product, condition, provenance, or anything buyers should know…"
                className="pd-textarea"
              />
            </div>
          </div>
        </section>

        {/* ── Pricing ── */}
        <section className="pd-sec">
          <div className="pd-sec-head">
            <div className="pd-sec-icon" data-tone="emer">
              <BadgeDollarSign size={16} />
            </div>
            <div>
              <div className="pd-sec-title">Pricing</div>
              <div className="pd-sec-sub">Price, currency, and negotiation options</div>
            </div>
          </div>
          <div className="pd-sec-body">
            <div className="pd-currency-row">
              <div className="pd-field">
                <label htmlFor="price" className="pd-label">
                  Price <span className="req">*</span>
                </label>
                <input
                  id="price"
                  name="price"
                  type="text"
                  required
                  inputMode="decimal"
                  defaultValue={initial?.price ?? ""}
                  placeholder="0.00"
                  className="pd-input mono"
                />
              </div>
              <div className="pd-field">
                <label htmlFor="currency" className="pd-label">Currency</label>
                <select
                  id="currency"
                  name="currency"
                  defaultValue={initial?.currency ?? "MMK"}
                  className="pd-select"
                >
                  <option value="USD">USD</option>
                  <option value="MMK">MMK</option>
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                <label
                  htmlFor="isNegotiable"
                  className={`pd-negotiable${isNegotiable ? " on" : ""}`}
                >
                  <input
                    id="isNegotiable"
                    type="checkbox"
                    name="isNegotiable"
                    checked={isNegotiable}
                    onChange={(e) => setIsNegotiable(e.target.checked)}
                    className="sr-only"
                  />
                  <span className="pd-toggle-chk">
                    <Check size={10} />
                  </span>
                  Negotiable
                </label>
              </div>
            </div>
          </div>
        </section>

        {/* ── Visibility ── */}
        <section className="pd-sec">
          <div className="pd-sec-head">
            <div className="pd-sec-icon" data-tone="purple">
              <Sparkles size={16} />
            </div>
            <div>
              <div className="pd-sec-title">Visibility</div>
              <div className="pd-sec-sub">
                Featured placement, collector piece, and privilege assist flags
              </div>
            </div>
          </div>
          <div className="pd-sec-body">
            <div className="pd-toggles">
              {/* Featured */}
              <label htmlFor="ft-featured" className={`pd-toggle${isFeatured ? " on" : ""}`}>
                <input
                  id="ft-featured"
                  type="checkbox"
                  name="isFeatured"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="sr-only"
                />
                <span className="pd-toggle-chk"><Check size={10} /></span>
                <div className="pd-toggle-text">
                  <span className="pd-toggle-label">Featured listing</span>
                  <span className="pd-toggle-sub">Boost on homepage &amp; search</span>
                </div>
              </label>

              {/* Collector */}
              <label htmlFor="ft-collector" className={`pd-toggle${isCollectorPiece ? " on" : ""}`}>
                <input
                  id="ft-collector"
                  type="checkbox"
                  name="isCollectorPiece"
                  checked={isCollectorPiece}
                  onChange={(e) => setIsCollectorPiece(e.target.checked)}
                  className="sr-only"
                />
                <span className="pd-toggle-chk"><Check size={10} /></span>
                <div className="pd-toggle-text">
                  <span className="pd-toggle-label">Collector piece</span>
                  <span className="pd-toggle-sub">Curated for serious buyers</span>
                </div>
              </label>

              {/* Privilege */}
              <label htmlFor="ft-privilege" className={`pd-toggle${isPrivilegeAssist ? " on" : ""}`}>
                <input
                  id="ft-privilege"
                  type="checkbox"
                  name="isPrivilegeAssist"
                  checked={isPrivilegeAssist}
                  onChange={(e) => setIsPrivilegeAssist(e.target.checked)}
                  className="sr-only"
                />
                <span className="pd-toggle-chk"><Check size={10} /></span>
                <div className="pd-toggle-text">
                  <span className="pd-toggle-label">Privilege Assist</span>
                  <span className="pd-toggle-sub">Premium concierge support</span>
                </div>
              </label>

              {/* Promotion */}
              <label htmlFor="ft-promotion" className={`pd-toggle${isPromotion ? " on" : ""}`}>
                <input
                  id="ft-promotion"
                  type="checkbox"
                  name="isPromotion"
                  checked={isPromotion}
                  onChange={(e) => setIsPromotion(e.target.checked)}
                  className="sr-only"
                />
                <span className="pd-toggle-chk"><Check size={10} /></span>
                <div className="pd-toggle-text">
                  <span className="pd-toggle-label">Promotion</span>
                  <span className="pd-toggle-sub">Flag as a promotional item</span>
                </div>
              </label>
            </div>
          </div>
        </section>

        {/* ── Product type & category ── */}
        <section className="pd-sec">
          <div className="pd-sec-head">
            <div className="pd-sec-icon" data-tone="blue">
              <Layers size={16} />
            </div>
            <div>
              <div className="pd-sec-title">Product type &amp; category</div>
              <div className="pd-sec-sub">
                {productType === "jewellery"
                  ? "Category, metal, then add each gemstone below with full specs"
                  : "Product type (loose stone or jewellery) and category"}
              </div>
            </div>
          </div>
          <div className="pd-sec-body">
            <div className="pd-row" style={{ "--cols": 3 } as React.CSSProperties}>
              <div className="pd-field">
                <label htmlFor="productType" className="pd-label">
                  Product type <span className="req">*</span>
                </label>
                <select
                  id="productType"
                  name="productType"
                  value={productType}
                  onChange={(e) => setProductType(e.target.value as "loose_stone" | "jewellery")}
                  className="pd-select"
                  required
                >
                  <option value="loose_stone">Loose stone</option>
                  <option value="jewellery">Jewellery</option>
                </select>
              </div>
              <div className="pd-field">
                <label htmlFor="categoryId" className="pd-label">
                  Category <span className="req">*</span>
                </label>
                <select
                  id="categoryId"
                  name="categoryId"
                  key={productType}
                  defaultValue={initial?.categoryId ?? ""}
                  className="pd-select"
                  required
                >
                  <option value="">
                    {productType === "loose_stone"
                      ? "Select stone category"
                      : "Select jewellery category"}
                  </option>
                  {categoryOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              {productType === "loose_stone" ? (
                <div className="pd-field">
                  <label htmlFor="stoneCut" className="pd-label">Cut</label>
                  <select
                    id="stoneCut"
                    name="stoneCut"
                    defaultValue={initial?.stoneCut ?? ""}
                    className="pd-select"
                  >
                    <option value="">Select cut</option>
                    <option value="Faceted">Faceted</option>
                    <option value="Cabochon">Cabochon</option>
                  </select>
                </div>
              ) : (
                <div className="pd-field">
                  <label htmlFor="metal" className="pd-label">Metal</label>
                  <select
                    id="metal"
                    name="metal"
                    defaultValue={initial?.metal ?? ""}
                    className="pd-select"
                  >
                    <option value="">Select metal</option>
                    <option value="Gold">Gold</option>
                    <option value="Silver">Silver</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              )}
            </div>

            {/* Gemstones (jewellery only) */}
            {productType === "jewellery" && (
              <div className="pd-gems">
                <div className="pd-gems-head">
                  <div className="pd-gems-headtext">
                    <div className="pd-gems-title">
                      Gemstones in this piece
                      {jewelleryGemstones.length > 0 && (
                        <span className="pd-gems-count">{jewelleryGemstones.length}</span>
                      )}
                    </div>
                    <div className="pd-gems-sub">
                      {jewelleryGemstones.length === 0
                        ? "Add every stone type — opens a dialog with full specs"
                        : (
                          <>
                            <strong>{jewelleryGemstones.length}</strong> stone
                            {jewelleryGemstones.length !== 1 ? "s" : ""}
                          </>
                        )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="pd-btn pd-btn-primary"
                    onClick={openAddGemstoneDialog}
                    style={{ flexShrink: 0 }}
                  >
                    + Add gemstone
                  </button>
                </div>

                {jewelleryGemstones.length === 0 ? (
                  <div className="pd-gems-empty">
                    <div className="pd-gems-empty-ico">
                      <Gem size={18} />
                    </div>
                    <div className="pd-gems-empty-title">No gemstones yet</div>
                    <div className="pd-gems-empty-sub">
                      Click &quot;Add gemstone&quot; to add specifications in a pop-up dialog.
                    </div>
                    <button type="button" className="pd-btn" onClick={openAddGemstoneDialog}>
                      + Add first gemstone
                    </button>
                  </div>
                ) : (
                  <div className="pd-gems-list">
                    {jewelleryGemstones.map((row, i) => {
                      const stoneName = row.categoryId
                        ? (stoneOptions.find((c) => c.id === row.categoryId)?.name ?? categories.find((c) => c.id === row.categoryId)?.name ?? "—")
                        : "—"
                      return (
                        <div key={i} className="pd-gem">
                          <div className="pd-gem-main">
                            <div className="pd-gem-name">{stoneName}</div>
                            <div className="pd-gem-specs">
                              {[
                                row.weightCarat ? `${row.weightCarat} ct` : null,
                                row.color || null,
                                row.shape || null,
                                row.origin || null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </div>
                          </div>
                          <div className="pd-gem-actions">
                            <button
                              type="button"
                              title="View"
                              onClick={() => openViewGemstoneDialog(i)}
                              aria-label={`View ${stoneName}`}
                            >
                              <Eye size={13} />
                            </button>
                            <button
                              type="button"
                              title="Edit"
                              onClick={() => openEditGemstoneDialog(i)}
                              aria-label={`Edit ${stoneName}`}
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              type="button"
                              title="Remove"
                              className="pd-danger"
                              onClick={() => handleRemoveGemstone(i)}
                              aria-label={`Delete ${stoneName}`}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ── Specifications ── */}
        <section className="pd-sec">
          <div className="pd-sec-head">
            <div className="pd-sec-icon" data-tone="amber">
              <Gem size={16} />
            </div>
            <div>
              <div className="pd-sec-title">Specifications</div>
              <div className="pd-sec-sub">
                {productType === "jewellery"
                  ? "Total weight of the piece — gemstone specs are set per stone above"
                  : "Physical attributes and gemology details"}
              </div>
            </div>
          </div>
          <div className="pd-sec-body">
            <div className="pd-row" style={{ "--cols": 2 } as React.CSSProperties}>
              {productType === "jewellery" && (
                <div className="pd-field">
                  <label htmlFor="totalWeightGrams" className="pd-label">
                    Total weight (g)
                  </label>
                  <div className="pd-input-suffix">
                    <input
                      id="totalWeightGrams"
                      name="totalWeightGrams"
                      type="text"
                      inputMode="decimal"
                      defaultValue={initial?.totalWeightGrams ?? ""}
                      placeholder="e.g. 28.48"
                      className="pd-input mono"
                    />
                    <span className="pd-sfx">g</span>
                  </div>
                </div>
              )}
              {productType === "jewellery" ? (
                <div className="pd-field">
                  <label htmlFor="pieceCount" className="pd-label">Total pieces</label>
                  <input
                    id="pieceCount"
                    name="pieceCount"
                    type="text"
                    inputMode="numeric"
                    defaultValue={initial?.pieceCount ?? ""}
                    placeholder="e.g. 3"
                    className="pd-input mono"
                  />
                </div>
              ) : (
                <div className="pd-field">
                  <label htmlFor="weightCarat" className="pd-label">
                    Weight (carat)<span className="req"> *</span>
                  </label>
                  <div className="pd-input-suffix">
                    <input
                      id="weightCarat"
                      name="weightCarat"
                      type="text"
                      required
                      inputMode="decimal"
                      defaultValue={initial?.weightCarat ?? ""}
                      placeholder="e.g. 2.5"
                      className="pd-input mono"
                    />
                    <span className="pd-sfx">ct</span>
                  </div>
                </div>
              )}
              {productType === "loose_stone" && (
                <div className="pd-field">
                  <label className="pd-label">
                    Dimensions <span className="pd-label-hint">W × H × D in mm</span>
                  </label>
                  <div className="pd-dim-group">
                    <input
                      type="text"
                      inputMode="decimal"
                      maxLength={50}
                      value={dimensionsPart1}
                      onChange={(e) => setDimensionsPart1(e.target.value)}
                      placeholder="8.2"
                      className="pd-input mono"
                    />
                    <span className="pd-dim-x">×</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      maxLength={50}
                      value={dimensionsPart2}
                      onChange={(e) => setDimensionsPart2(e.target.value)}
                      placeholder="6.1"
                      className="pd-input mono"
                    />
                    <span className="pd-dim-x">×</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      maxLength={50}
                      value={dimensionsPart3}
                      onChange={(e) => setDimensionsPart3(e.target.value)}
                      placeholder="4.0"
                      className="pd-input mono"
                    />
                    <span style={{ fontSize: 11, color: "var(--lv-text-3)" }}>mm</span>
                  </div>
                </div>
              )}
            </div>

            {productType === "loose_stone" && (
              <div className="pd-row" style={{ "--cols": 3 } as React.CSSProperties}>
                <div className="pd-field">
                  <label htmlFor="shape" className="pd-label">Shape</label>
                  <select
                    id="shape"
                    name="shape"
                    defaultValue={initial?.shape ?? ""}
                    className="pd-select"
                  >
                    <option value="">Select shape</option>
                    {SHAPES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="pd-field">
                  <label htmlFor="color" className="pd-label">
                    Color <span className="req">*</span>
                  </label>
                  <input
                    id="color"
                    name="color"
                    type="text"
                    required
                    maxLength={100}
                    defaultValue={initial?.color ?? ""}
                    placeholder="e.g. Pigeon Blood Red"
                    className="pd-input"
                  />
                </div>
                <div className="pd-field">
                  <label htmlFor="origin" className="pd-label">
                    Origin <span className="req">*</span>
                  </label>
                  <input
                    id="origin"
                    name="origin"
                    type="text"
                    required
                    maxLength={100}
                    defaultValue={initial?.origin ?? ""}
                    placeholder="e.g. Burma"
                    className="pd-input"
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── Certification ── */}
        <section className="pd-sec">
          <div className="pd-sec-head">
            <div className="pd-sec-icon" data-tone="rose">
              <Award size={16} />
            </div>
            <div>
              <div className="pd-sec-title">Certification</div>
              <div className="pd-sec-sub">Lab reports and authenticity documentation</div>
            </div>
            <div className="pd-sec-tools">
              <label
                className={`pd-btn${uploadingCertificate ? " disabled" : ""}`}
                style={uploadingCertificate ? { opacity: 0.6, pointerEvents: "none" } : {}}
              >
                <FileText size={13} />
                {uploadingCertificate ? "Uploading…" : "Upload certificate"}
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  disabled={uploadingCertificate}
                  onChange={(e) => {
                    handleUploadCertificate(e.target.files)
                    e.target.value = ""
                  }}
                />
              </label>
            </div>
          </div>
          <div className="pd-sec-body">
            <div className="pd-row" style={{ "--cols": 2 } as React.CSSProperties}>
              <div className="pd-field">
                <label htmlFor="laboratoryId" className="pd-label">Laboratory</label>
                <select
                  id="laboratoryId"
                  name="laboratoryId"
                  defaultValue={initial?.laboratoryId ?? ""}
                  className="pd-select"
                >
                  <option value="">Select laboratory</option>
                  {laboratories.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="pd-field">
                <label className="pd-label">Certificate</label>
                {certReportUrl ? (
                  <CertificateViewer
                    url={certReportUrl}
                    onRemove={() => setCertReportUrl("")}
                  />
                ) : (
                  <span className="pd-hint">No certificate uploaded yet.</span>
                )}
              </div>
              <div className="pd-field">
                <label htmlFor="certReportNumber" className="pd-label">Report number</label>
                <input
                  id="certReportNumber"
                  name="certReportNumber"
                  type="text"
                  maxLength={100}
                  defaultValue={initial?.certReportNumber ?? ""}
                  placeholder="e.g. GRS2024-123456"
                  className="pd-input mono"
                />
              </div>
              <div className="pd-field">
                <label htmlFor="certReportDate" className="pd-label">Report date</label>
                <input
                  id="certReportDate"
                  name="certReportDate"
                  type="date"
                  defaultValue={initial?.certReportDate ?? ""}
                  className="pd-input"
                />
              </div>
            </div>
            <div className="pd-field">
              <label htmlFor="additionalMemos" className="pd-label">
                Additional memos{" "}
                <span className="pd-label-hint">Not visible to buyers</span>
              </label>
              <textarea
                id="additionalMemos"
                name="additionalMemos"
                rows={4}
                maxLength={5000}
                defaultValue={initial?.additionalMemos ?? ""}
                placeholder="Internal notes, certificate clarifications, or reminders…"
                className="pd-textarea"
              />
            </div>
          </div>
        </section>

        {/* ── Notes & description ── */}
        <section className="pd-sec">
          <div className="pd-sec-head">
            <div className="pd-sec-icon" data-tone="slate">
              <StickyNote size={16} />
            </div>
            <div>
              <div className="pd-sec-title">Notes &amp; description</div>
              <div className="pd-sec-sub">Listing copy and optional extra details shown to buyers</div>
            </div>
            <div className="pd-sec-tools">
              <div className="pd-tabs">
                <button
                  type="button"
                  className={`pd-tab${notesTab === "description" ? " on" : ""}`}
                  onClick={() => setNotesTab("description")}
                >
                  Description
                </button>
                <button
                  type="button"
                  className={`pd-tab${notesTab === "extra" ? " on" : ""}`}
                  onClick={() => setNotesTab("extra")}
                >
                  Extra info
                </button>
              </div>
            </div>
          </div>
          <div className="pd-sec-body">
            {/* Always render description textarea (even when tab is "extra") so it submits */}
            <div className={notesTab !== "description" ? "hidden" : undefined}>
              <div className="pd-field">
                <label htmlFor="listingDescription" className="pd-label">
                  Description{" "}
                  <span className="pd-label-hint">Shown on the listing · max 5,000 chars</span>
                </label>
                <textarea
                  id="listingDescription"
                  name="listingDescription"
                  rows={8}
                  maxLength={5000}
                  defaultValue={initial?.description ?? ""}
                  placeholder="Describe the product, condition, provenance, or anything buyers should know…"
                  className="pd-textarea"
                  style={{ minHeight: 130 }}
                />
              </div>
            </div>
            {notesTab === "extra" && (
              <p className="pd-hint">
                Additional structured fields can be added here. Use the Description tab for
                listing text.
              </p>
            )}
          </div>
        </section>
      </form>

      {/* ── Gemstone dialog ── */}
      {productType === "jewellery" && (
        <Dialog open={gemstoneDialogOpen} onOpenChange={setGemstoneDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {gemstoneDialogMode === "add"
                  ? "Add gemstone"
                  : gemstoneDialogMode === "edit"
                    ? "Edit gemstone"
                    : "Gemstone details"}
              </DialogTitle>
              <DialogDescription>
                {gemstoneDialogMode === "view"
                  ? "View-only. Use Edit to change."
                  : "Stone type, weight, and specifications."}
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[min(70vh,28rem)] overflow-y-auto pr-1 -mr-1">
              <div className="grid gap-3 py-2 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-medium">Stone type</label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                    value={gemstoneDialogForm.categoryId}
                    onChange={(e) =>
                      setGemstoneDialogForm((p) => ({ ...p, categoryId: e.target.value }))
                    }
                    disabled={gemstoneDialogMode === "view"}
                  >
                    <option value="">Select</option>
                    {gemstoneDialogForm.categoryId && !stoneOptions.some((c) => c.id === gemstoneDialogForm.categoryId) && (() => {
                      const orphan = categories.find((c) => c.id === gemstoneDialogForm.categoryId)
                      return orphan ? <option key={orphan.id} value={orphan.id}>{orphan.name}</option> : null
                    })()}
                    {stoneOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Weight (ct) *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 0.5"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                    value={gemstoneDialogForm.weightCarat}
                    onChange={(e) =>
                      setGemstoneDialogForm((p) => ({ ...p, weightCarat: e.target.value }))
                    }
                    disabled={gemstoneDialogMode === "view"}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Color</label>
                  <input
                    type="text"
                    placeholder="e.g. Pigeon Blood"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                    value={gemstoneDialogForm.color}
                    onChange={(e) =>
                      setGemstoneDialogForm((p) => ({ ...p, color: e.target.value }))
                    }
                    disabled={gemstoneDialogMode === "view"}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Shape</label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                    value={gemstoneDialogForm.shape}
                    onChange={(e) =>
                      setGemstoneDialogForm((p) => ({ ...p, shape: e.target.value }))
                    }
                    disabled={gemstoneDialogMode === "view"}
                  >
                    <option value="">Select shape</option>
                    {SHAPES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Origin</label>
                  <input
                    type="text"
                    placeholder="e.g. Burma"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                    value={gemstoneDialogForm.origin}
                    onChange={(e) =>
                      setGemstoneDialogForm((p) => ({ ...p, origin: e.target.value }))
                    }
                    disabled={gemstoneDialogMode === "view"}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Cut</label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                    value={gemstoneDialogForm.cut}
                    onChange={(e) =>
                      setGemstoneDialogForm((p) => ({ ...p, cut: e.target.value }))
                    }
                    disabled={gemstoneDialogMode === "view"}
                  >
                    <option value="">Select cut</option>
                    <option value="Faceted">Faceted</option>
                    <option value="Cabochon">Cabochon</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Transparency</label>
                  <input
                    type="text"
                    placeholder="e.g. Transparent"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                    value={gemstoneDialogForm.transparency}
                    onChange={(e) =>
                      setGemstoneDialogForm((p) => ({ ...p, transparency: e.target.value }))
                    }
                    disabled={gemstoneDialogMode === "view"}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Piece count</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 2"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                    value={gemstoneDialogForm.pieceCount}
                    onChange={(e) =>
                      setGemstoneDialogForm((p) => ({ ...p, pieceCount: e.target.value }))
                    }
                    disabled={gemstoneDialogMode === "view"}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-medium">Inclusions</label>
                  <input
                    type="text"
                    placeholder="e.g. Minor needle inclusions"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                    value={gemstoneDialogForm.inclusions}
                    onChange={(e) =>
                      setGemstoneDialogForm((p) => ({ ...p, inclusions: e.target.value }))
                    }
                    disabled={gemstoneDialogMode === "view"}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-medium">Comment</label>
                  <input
                    type="text"
                    placeholder="Any additional notes"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                    value={gemstoneDialogForm.comment}
                    onChange={(e) =>
                      setGemstoneDialogForm((p) => ({ ...p, comment: e.target.value }))
                    }
                    disabled={gemstoneDialogMode === "view"}
                  />
                </div>
              </div>
            </div>
            <DialogFooter className="shrink-0 gap-2 sm:gap-0">
              {gemstoneDialogMode === "view" ? (
                <Button type="button" variant="outline" onClick={() => setGemstoneDialogOpen(false)}>
                  Close
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setGemstoneDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSaveGemstoneDialog}
                    disabled={
                      !gemstoneDialogForm.categoryId ||
                      gemstoneDialogForm.weightCarat.trim() === ""
                    }
                  >
                    {gemstoneDialogMode === "add" ? "Add" : "Save"}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {viewerIdx !== null && imageUrlsList.length > 0 && (
        <ImageViewer
          images={imageUrlsList}
          initialIndex={viewerIdx}
          onClose={() => setViewerIdx(null)}
        />
      )}

      {videoViewerIdx !== null && videoUrlsList.length > 0 && (
        <VideoViewer
          videos={videoUrlsList}
          initialIndex={videoViewerIdx}
          onClose={() => setVideoViewerIdx(null)}
        />
      )}
    </div>
  )
}
