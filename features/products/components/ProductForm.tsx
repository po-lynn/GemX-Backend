"use client"

import Image from "next/image"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { createProductAction, updateProductAction } from "@/features/products/actions/products"
import type { ProductForEdit } from "@/features/products/db/products"
import { PRODUCT_IDENTIFICATION_OPTIONS } from "@/features/products/schemas/products"
import { FormActionBar } from "@/features/products/components/FormActionBar"
import { cn } from "@/lib/utils"
import { FileText, Eye, Pencil, Trash2, Upload, Video, X } from "lucide-react"

const inputClass =
  "flex h-10 w-full rounded-lg border border-[var(--form-input-border)] bg-[var(--form-bg)] px-3.5 py-2.5 text-sm text-[var(--form-foreground)] transition-shadow placeholder:text-[var(--form-muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--form-focus-ring)] focus:ring-offset-0 focus:border-[var(--form-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50 file:border-0 file:bg-transparent file:text-sm file:font-medium"

const MAX_PRODUCT_IMAGES = 10
const MAX_PRODUCT_VIDEOS = 5

function FormSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-[var(--form-section-border)] bg-[var(--form-section-bg)] p-6 shadow-[var(--form-shadow)]">
      <div className="mb-5">
        <h2 className="text-base font-semibold tracking-tight text-[var(--form-foreground)]">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm text-[var(--form-muted-foreground)]">{description}</p>
        )}
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  )
}

const SHAPES = ["Oval", "Cushion", "Round", "Pear", "Heart"] as const
import type { CategoryRow } from "@/features/categories/db/categories"

type Props = {
  mode: "create" | "edit"
  product?: ProductForEdit | null
  categories: CategoryRow[]
}

import type { LaboratoryOption } from "@/features/laboratory/db/laboratory"
import type { OriginOption } from "@/features/origin/db/origin"

type LabProps = {
  mode: "create" | "edit"
  product?: ProductForEdit | null
  laboratories?: LaboratoryOption[] | null
  origins?: OriginOption[] | null
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

function CertificateViewer({ url, onRemove }: { url: string; onRemove: () => void }) {
  const isPdf = isPdfUrl(url)
  return (
    <div className="rounded-lg border border-[var(--form-input-border)] bg-[var(--form-muted)]/30 overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--form-input-border)] px-3 py-2">
        <span className="text-sm font-medium text-[var(--form-foreground)]">
          Certificate {isPdf ? "(PDF)" : "(image)"}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={onRemove}
        >
          <X className="h-4 w-4 mr-1" />
          Remove
        </Button>
      </div>
      <div className="min-h-[280px] max-h-[480px] flex items-center justify-center bg-[var(--form-bg)]">
        {isPdf ? (
          <iframe
            src={url}
            title="Certificate PDF"
            className="w-full h-[400px] min-h-[360px] border-0"
          />
        ) : (
          <div className="relative w-full min-h-[280px] max-h-[420px] flex-1">
            <Image
              src={url}
              alt="Certificate"
              fill
              className="object-contain"
              unoptimized={url.startsWith("blob:") || url.startsWith("data:")}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export function ProductForm({ mode, product, categories, laboratories, origins }: Props & LabProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const isEdit = mode === "edit"

  const [productType, setProductType] = useState<"loose_stone" | "jewellery">(
    product?.productType ?? "loose_stone"
  )
  const [dimensionsPart1, setDimensionsPart1] = useState(() =>
    parseDimensions(product?.dimensions)[0]
  )
  const [dimensionsPart2, setDimensionsPart2] = useState(() =>
    parseDimensions(product?.dimensions)[1]
  )
  const [dimensionsPart3, setDimensionsPart3] = useState(() =>
    parseDimensions(product?.dimensions)[2]
  )
  useEffect(() => {
    const [p1, p2, p3] = parseDimensions(product?.dimensions)
    setDimensionsPart1(p1)
    setDimensionsPart2(p2)
    setDimensionsPart3(p3)
  }, [product?.dimensions])
  const categoryOptions = categories.filter((c) => c.type === productType)
  const stoneOptions = categories.filter((c) => c.type === "loose_stone")
  const [status, setStatus] = useState<"active" | "archive" | "sold" | "hidden">(
    (product?.status as "active" | "archive" | "sold" | "hidden") ?? "active"
  )
  const [imageUrlsList, setImageUrlsList] = useState<string[]>(product?.imageUrls ?? [])
  const [videoUrlsList, setVideoUrlsList] = useState<string[]>(product?.videoUrls ?? [])
  const [uploadingImages, setUploadingImages] = useState(false)
  const [uploadingVideos, setUploadingVideos] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [certReportUrl, setCertReportUrl] = useState(product?.certReportUrl ?? "")
  const [uploadingCertificate, setUploadingCertificate] = useState(false)
  useEffect(() => {
    setImageUrlsList(product?.imageUrls ?? [])
    setVideoUrlsList(product?.videoUrls ?? [])
  }, [product?.imageUrls, product?.videoUrls])
  useEffect(() => {
    setCertReportUrl(product?.certReportUrl ?? "")
  }, [product?.certReportUrl])

  const [isPromotion, setIsPromotion] = useState(product?.isPromotion ?? false)
  useEffect(() => {
    setIsPromotion(product?.isPromotion ?? false)
  }, [product?.id, product?.isPromotion])

  function handleUploadMedia(type: "image" | "video", files: FileList | null) {
    if (!files?.length) return
    setUploadError(null)
    const maxCount = type === "image" ? MAX_PRODUCT_IMAGES : MAX_PRODUCT_VIDEOS
    const currentList = type === "image" ? imageUrlsList : videoUrlsList
    const currentCount = currentList.length
    if (currentCount >= maxCount) {
      setUploadError(
        type === "image"
          ? `Maximum ${MAX_PRODUCT_IMAGES} images. You have ${currentCount}.`
          : `Maximum ${MAX_PRODUCT_VIDEOS} videos. You have ${currentCount}.`
      )
      return
    }
    const slotsLeft = maxCount - currentCount
    if (files.length > slotsLeft) {
      setUploadError(
        type === "image"
          ? `Maximum ${MAX_PRODUCT_IMAGES} images. You have ${currentCount}. Add up to ${slotsLeft} more.`
          : `Maximum ${MAX_PRODUCT_VIDEOS} videos. You have ${currentCount}. Add up to ${slotsLeft} more.`
      )
      return
    }
    setUploadProgress(0)
    if (type === "image") setUploadingImages(true)
    else setUploadingVideos(true)
    const formData = new FormData()
    formData.set("type", type)
    for (let i = 0; i < files.length; i++) formData.append("files", files[i])
    const xhr = new XMLHttpRequest()
    xhr.open("POST", "/api/upload/product-media")
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        setUploadProgress(Math.round((e.loaded / e.total) * 100))
      }
    })
    xhr.addEventListener("load", () => {
      try {
        const data = JSON.parse(xhr.responseText || "{}")
        if (xhr.status >= 200 && xhr.status < 300) {
          const urls = (data.urls as string[]) ?? []
          if (type === "image") setImageUrlsList((prev) => [...prev, ...urls].slice(0, MAX_PRODUCT_IMAGES))
          else setVideoUrlsList((prev) => [...prev, ...urls].slice(0, MAX_PRODUCT_VIDEOS))
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
    const file = files[0]
    setUploadError(null)
    setUploadingCertificate(true)
    const formData = new FormData()
    formData.set("file", file)
    const xhr = new XMLHttpRequest()
    xhr.open("POST", "/api/upload/certificate")
    xhr.addEventListener("load", () => {
      try {
        const data = JSON.parse(xhr.responseText || "{}")
        if (xhr.status >= 200 && xhr.status < 300 && data.url) {
          setCertReportUrl(data.url)
        } else {
          setUploadError(data.error || `Upload failed (${xhr.status})`)
        }
      } catch {
        setUploadError("Upload failed")
      } finally {
        setUploadingCertificate(false)
      }
    })
    xhr.addEventListener("error", () => {
      setUploadError("Upload failed")
      setUploadingCertificate(false)
    })
    xhr.addEventListener("abort", () => setUploadingCertificate(false))
    xhr.send(formData)
  }

  /** Form state: all string for inputs; maps to JewelleryGemstoneItem when submitting. */
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
    categoryName?: string
  }
  const emptyGemstone = (): FormGemstoneEntry => ({
    categoryId: "",
    weightCarat: "",
    pieceCount: "",
    dimensions: "",
    color: "",
    shape: "",
    origin: "",
    cut: "",
    transparency: "",
    comment: "",
    inclusions: "",
  })
  const [jewelleryGemstones, setJewelleryGemstones] = useState<FormGemstoneEntry[]>(
    (product?.jewelleryGemstones ?? []).map((g) => ({
      categoryId: g.categoryId,
      weightCarat: g.weightCarat,
      pieceCount: g.pieceCount != null ? String(g.pieceCount) : "",
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
  const [gemstoneDialogForm, setGemstoneDialogForm] = useState<FormGemstoneEntry>(() => emptyGemstone())

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
  }
  function handleRemoveGemstone(index: number) {
    setJewelleryGemstones((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const form = e.currentTarget
    const formData = new FormData(form)
    if (productType === "jewellery") {
      formData.set(
        "jewelleryGemstones",
        JSON.stringify(
          jewelleryGemstones
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
        )
      )
    }

    try {
      const result = isEdit
        ? await updateProductAction(formData)
        : await createProductAction(formData)

      if (result?.error) {
        setError(result.error)
        setLoading(false)
        return
      }

      router.push("/admin/products")
      router.refresh()
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const breadcrumbs: { href: string; label: string }[] = isEdit
    ? [
        { href: "/admin/products", label: "Products" },
        { href: `/admin/products/${product?.id}/edit`, label: product?.title ? (product.title.length > 40 ? product.title.slice(0, 40) + "…" : product.title) : "Edit" },
      ]
    : [
        { href: "/admin/products", label: "Products" },
        { href: "/admin/products/new", label: "New Product" },
      ]

  const recordTitle = isEdit ? (product?.title ?? "Product") : "New Product"
  const [notesTab, setNotesTab] = useState<"notes" | "extra">("extra")
  const [sidebarTab, setSidebarTab] = useState<"message" | "note" | "activity">("activity")

  return (
    <Card className="odoo-form rounded-2xl border-0 bg-[var(--form-bg-subtle)] shadow-[var(--form-shadow-md)]">
      <FormActionBar
        breadcrumbs={breadcrumbs}
        currentStatus={status}
        onStatusChange={(value) => setStatus(value as typeof status)}
        saveLabel="Save"
        saveLoading={loading}
        discardHref="/admin/products"
        formId="product-form"
      />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px]">
        {/* Left pane: form content */}
        <div className="min-w-0 border-r border-[var(--form-border)]">
          <div className="p-8">
            {/* Hero: record title + key metrics in a soft card */}
            <div className="rounded-xl border border-[var(--form-section-border)] bg-[var(--form-section-bg)] p-6 shadow-[var(--form-shadow)]">
              <h1 className="text-2xl font-bold tracking-tight text-[var(--form-foreground)] sm:text-3xl">
                {recordTitle}
              </h1>
              <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-4">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wider text-[var(--form-muted-foreground)]">Price</div>
                  <div className="mt-1 text-lg font-semibold text-[var(--form-foreground)]">
                    {product?.price != null ? `${product.currency} ${product.price}` : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wider text-[var(--form-muted-foreground)]">Status</div>
                  <div className="mt-1 text-lg font-semibold capitalize text-[var(--form-foreground)]">
                    {status}
                  </div>
                </div>
                {isEdit && product?.sku && (
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wider text-[var(--form-muted-foreground)]">SKU</div>
                    <div className="mt-1 font-mono text-sm font-semibold text-[var(--form-foreground)]">
                      {product.sku}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <form id="product-form" onSubmit={handleSubmit} className="flex flex-col gap-6 px-8 pb-8">
            {isEdit && (
              <input
                type="hidden"
                name="productId"
                value={product?.id ?? ""}
              />
            )}
            <input type="hidden" name="status" value={status} />

            {/* Featured, Collector Piece, Privilege Assist, Promotion */}
            <div className="-mt-2 space-y-4 rounded-xl border border-[var(--form-section-border)] bg-[var(--form-section-bg)] p-5 shadow-[var(--form-shadow)]">
              <div className="flex flex-wrap items-center gap-6">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    name="isFeatured"
                    defaultChecked={product?.isFeatured ?? false}
                    className="size-4 rounded border-[var(--form-input-border)] text-[var(--form-primary)] focus:ring-2 focus:ring-[var(--form-focus-ring)]"
                  />
                  <span className="text-sm font-medium text-[var(--form-foreground)]">Featured</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    name="isCollectorPiece"
                    defaultChecked={product?.isCollectorPiece ?? false}
                    className="size-4 rounded border-[var(--form-input-border)] text-[var(--form-primary)] focus:ring-2 focus:ring-[var(--form-focus-ring)]"
                  />
                  <span className="text-sm font-medium text-[var(--form-foreground)]">Collector Piece</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    name="isPrivilegeAssist"
                    defaultChecked={product?.isPrivilegeAssist ?? false}
                    className="size-4 rounded border-[var(--form-input-border)] text-[var(--form-primary)] focus:ring-2 focus:ring-[var(--form-focus-ring)]"
                  />
                  <span className="text-sm font-medium text-[var(--form-foreground)]">Privilege Assist</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    name="isPromotion"
                    checked={isPromotion}
                    onChange={(e) => setIsPromotion(e.target.checked)}
                    className="size-4 rounded border-[var(--form-input-border)] text-[var(--form-primary)] focus:ring-2 focus:ring-[var(--form-focus-ring)]"
                  />
                  <span className="text-sm font-medium text-[var(--form-foreground)]">Promotion</span>
                </label>
              </div>
              {isPromotion && (
                <div
                  role="status"
                  className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-[var(--form-foreground)]"
                >
                  <p className="font-medium text-amber-900 dark:text-amber-100">For promotion</p>
                  <p className="mt-1 text-[var(--form-muted-foreground)]">
                    This listing is flagged as a promotion item. 
                  </p>
                </div>
              )}
            </div>

            <FormSection
            title="Basic Info"
            description="Core product identification and description"
          >
            <div className="space-y-2">
              <label htmlFor="title" className="text-sm font-medium">
                Title *
              </label>
              <input
                id="title"
                name="title"
                type="text"
                required
                maxLength={200}
                defaultValue={product?.title ?? ""}
                placeholder="Product title"
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="identification" className="text-sm font-medium">
                Identification *
              </label>
              <select
                id="identification"
                name="identification"
                required
                defaultValue={
                  product?.identification &&
                  PRODUCT_IDENTIFICATION_OPTIONS.includes(
                    product.identification as (typeof PRODUCT_IDENTIFICATION_OPTIONS)[number]
                  )
                    ? product.identification
                    : "Natural"
                }
                className={inputClass}
              >
                <option value="">Select…</option>
                {PRODUCT_IDENTIFICATION_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </FormSection>

          <FormSection
            title="Pricing"
            description="Price, currency, and negotiation options"
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <label htmlFor="price" className="text-sm font-medium">
                  Price *
                </label>
                <input
                  id="price"
                  name="price"
                  type="text"
                  required
                  inputMode="decimal"
                  defaultValue={product?.price ?? ""}
                  placeholder="0.00"
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="currency" className="text-sm font-medium">
                  Currency
                </label>
                <select
                  id="currency"
                  name="currency"
                  defaultValue={product?.currency ?? "USD"}
                  className={inputClass}
                >
                  <option value="USD">USD</option>
                  <option value="MMK">MMK</option>
                </select>
              </div>
              <div className="flex items-end gap-2 pb-2">
                <input
                  id="isNegotiable"
                  name="isNegotiable"
                  type="checkbox"
                  defaultChecked={product?.isNegotiable ?? false}
                  className="size-4 rounded border-input"
                />
                <label htmlFor="isNegotiable" className="text-sm font-medium">
                  Negotiable
                </label>
              </div>
            </div>
            {isPromotion ? (
              <div className="space-y-2 border-t border-[var(--form-section-border)] pt-4">
                <label htmlFor="promotionComparePrice" className="text-sm font-medium">
                  Original price before discount
                </label>
                <input
                  id="promotionComparePrice"
                  name="promotionComparePrice"
                  type="text"
                  inputMode="decimal"
                  defaultValue={product?.promotionComparePrice ?? ""}
                  placeholder="e.g. original price before discount"
                  className={`${inputClass} max-w-xs`}
                />
                <p className="text-xs text-[var(--form-muted-foreground)]">
                  Enter a price <span className="font-medium">above</span> the sale price. The admin products table shows{" "}
                  <span className="font-medium">Save …</span> as the difference (compare at − sale).
                </p>
              </div>
            ) : (
              <input type="hidden" name="promotionComparePrice" value="" />
            )}
          </FormSection>

          <FormSection
            title="Product Type & Category"
            description={
              productType === "jewellery"
                ? "Category (e.g. Necklace, Necklace Set, Ring), metal, then add each gemstone type below with full specs."
                : "Product type (loose stone or jewellery) and category"
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="productType" className="text-sm font-medium">
                  Product type *
                </label>
                <select
                  id="productType"
                  name="productType"
                  value={productType}
                  onChange={(e) =>
                    setProductType(e.target.value as "loose_stone" | "jewellery")
                  }
                  className={inputClass}
                  required
                >
                  <option value="loose_stone">Loose stone</option>
                  <option value="jewellery">Jewellery</option>
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="categoryId" className="text-sm font-medium">
                  Category *
                </label>
                <select
                  id="categoryId"
                  name="categoryId"
                  key={productType}
                  defaultValue={product?.categoryId ?? ""}
                  className={inputClass}
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
              {productType === "loose_stone" && (
                <div className="space-y-2">
                  <label htmlFor="stoneCut" className="text-sm font-medium">
                    Cut
                  </label>
                  <select
                    id="stoneCut"
                    name="stoneCut"
                    defaultValue={product?.stoneCut ?? ""}
                    className={inputClass}
                  >
                    <option value="">Select cut</option>
                    <option value="Faceted">Faceted</option>
                    <option value="Cabochon">Cabochon</option>
                  </select>
                </div>
              )}
              {productType === "jewellery" && (
                <>
                  <div className="space-y-2">
                    <label htmlFor="metal" className="text-sm font-medium">
                      Metal
                    </label>
                    <select
                      id="metal"
                      name="metal"
                      defaultValue={product?.metal ?? ""}
                      className={inputClass}
                    >
                      <option value="">Select metal</option>
                      <option value="Gold">Gold</option>
                      <option value="Silver">Silver</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <label className="text-sm font-medium">Gemstones in this piece</label>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Add every stone type (Ruby, Emerald, Sapphire, Pearl, etc.). Click Add gemstone to open the form in a dialog; view, edit, or delete from the list below.
                        </p>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={openAddGemstoneDialog}>
                        Add gemstone
                      </Button>
                    </div>
                    {jewelleryGemstones.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border bg-muted/5 p-6 text-center">
                        <p className="text-muted-foreground text-sm">No gemstones added yet.</p>
                        <p className="text-muted-foreground text-xs mt-1">
                          Click &quot;Add gemstone&quot; to add specifications in a pop-up dialog.
                        </p>
                        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={openAddGemstoneDialog}>
                          Add gemstone
                        </Button>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-border overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border bg-muted/30">
                              <th className="px-4 py-2.5 text-left font-medium">Stone</th>
                              <th className="px-4 py-2.5 text-left font-medium">Weight (ct)</th>
                              <th className="px-4 py-2.5 text-left font-medium">Pieces</th>
                              <th className="px-4 py-2.5 text-right font-medium w-36">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {jewelleryGemstones.map((row, i) => {
                              const stoneName = row.categoryId
                                ? stoneOptions.find((c) => c.id === row.categoryId)?.name ?? "—"
                                : "—"
                              return (
                                <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/10">
                                  <td className="px-4 py-2.5 font-medium">{stoneName}</td>
                                  <td className="px-4 py-2.5 text-muted-foreground">{row.weightCarat || "—"}</td>
                                  <td className="px-4 py-2.5 text-muted-foreground">{row.pieceCount || "—"}</td>
                                  <td className="px-4 py-2.5 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => openViewGemstoneDialog(i)}
                                        aria-label={`View ${stoneName}`}
                                      >
                                        <Eye className="size-4" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => openEditGemstoneDialog(i)}
                                        aria-label={`Edit ${stoneName}`}
                                      >
                                        <Pencil className="size-4" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                        onClick={() => handleRemoveGemstone(i)}
                                        aria-label={`Delete ${stoneName}`}
                                      >
                                        <Trash2 className="size-4" />
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </FormSection>

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
                      ? "View-only. Use Edit from the list to change."
                      : "Stone type, weight, and specifications for this gemstone in the piece."}
                  </DialogDescription>
                </DialogHeader>
                <div className="overflow-y-auto max-h-[min(70vh,28rem)] pr-1 -mr-1">
                <div className="grid gap-3 py-2 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-medium">Stone type</label>
                    <select
                      className={inputClass}
                      value={gemstoneDialogForm.categoryId}
                      onChange={(e) =>
                        setGemstoneDialogForm((prev) => ({ ...prev, categoryId: e.target.value }))
                      }
                      disabled={gemstoneDialogMode === "view"}
                    >
                      <option value="">Select</option>
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
                      className={inputClass}
                      value={gemstoneDialogForm.weightCarat}
                      onChange={(e) =>
                        setGemstoneDialogForm((prev) => ({ ...prev, weightCarat: e.target.value }))
                      }
                      disabled={gemstoneDialogMode === "view"}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Pieces</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="e.g. 37"
                      className={inputClass}
                      value={gemstoneDialogForm.pieceCount}
                      onChange={(e) =>
                        setGemstoneDialogForm((prev) => ({ ...prev, pieceCount: e.target.value }))
                      }
                      disabled={gemstoneDialogMode === "view"}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Dimensions</label>
                    <input
                      type="text"
                      placeholder="e.g. 8.2 x 6.1 mm"
                      className={inputClass}
                      value={gemstoneDialogForm.dimensions}
                      onChange={(e) =>
                        setGemstoneDialogForm((prev) => ({ ...prev, dimensions: e.target.value }))
                      }
                      disabled={gemstoneDialogMode === "view"}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Color *</label>
                    <input
                      type="text"
                      placeholder="e.g. Pigeon Blood Red"
                      className={inputClass}
                      value={gemstoneDialogForm.color}
                      onChange={(e) =>
                        setGemstoneDialogForm((prev) => ({ ...prev, color: e.target.value }))
                      }
                      disabled={gemstoneDialogMode === "view"}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Shape</label>
                    <select
                      className={inputClass}
                      value={gemstoneDialogForm.shape}
                      onChange={(e) =>
                        setGemstoneDialogForm((prev) => ({ ...prev, shape: e.target.value }))
                      }
                      disabled={gemstoneDialogMode === "view"}
                    >
                      <option value="">Select</option>
                      {SHAPES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-medium">Origin *</label>
                    <input
                      type="text"
                      placeholder="e.g. Mogok, Myanmar"
                      className={inputClass}
                      value={gemstoneDialogForm.origin}
                      onChange={(e) =>
                        setGemstoneDialogForm((prev) => ({ ...prev, origin: e.target.value }))
                      }
                      disabled={gemstoneDialogMode === "view"}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Cut</label>
                    <input
                      type="text"
                      placeholder="e.g. Mixed cut, brilliant/step"
                      className={inputClass}
                      value={gemstoneDialogForm.cut}
                      onChange={(e) =>
                        setGemstoneDialogForm((prev) => ({ ...prev, cut: e.target.value }))
                      }
                      disabled={gemstoneDialogMode === "view"}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Transparency</label>
                    <input
                      type="text"
                      placeholder="e.g. Transparent"
                      className={inputClass}
                      value={gemstoneDialogForm.transparency}
                      onChange={(e) =>
                        setGemstoneDialogForm((prev) => ({ ...prev, transparency: e.target.value }))
                      }
                      disabled={gemstoneDialogMode === "view"}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-medium">Comment</label>
                    <input
                      type="text"
                      placeholder="e.g. No indication of thermal treatment, FTIR-tested"
                      className={inputClass}
                      value={gemstoneDialogForm.comment}
                      onChange={(e) =>
                        setGemstoneDialogForm((prev) => ({ ...prev, comment: e.target.value }))
                      }
                      disabled={gemstoneDialogMode === "view"}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-medium">Inclusions (magnification)</label>
                    <input
                      type="text"
                      placeholder="e.g. Rutiles, feathers, solids, zoning"
                      className={inputClass}
                      value={gemstoneDialogForm.inclusions}
                      onChange={(e) =>
                        setGemstoneDialogForm((prev) => ({ ...prev, inclusions: e.target.value }))
                      }
                      disabled={gemstoneDialogMode === "view"}
                    />
                  </div>
                </div>
                </div>
                <DialogFooter className="gap-2 sm:gap-0 shrink-0">
                  {gemstoneDialogMode === "view" ? (
                    <Button type="button" variant="outline" onClick={() => setGemstoneDialogOpen(false)}>
                      Close
                    </Button>
                  ) : (
                    <>
                      <Button type="button" variant="outline" onClick={() => setGemstoneDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        onClick={handleSaveGemstoneDialog}
                        disabled={
                          !gemstoneDialogForm.categoryId ||
                          gemstoneDialogForm.weightCarat.trim() === "" ||
                          gemstoneDialogForm.color.trim() === "" ||
                          gemstoneDialogForm.origin.trim() === ""
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

          <FormSection
            title="Specifications"
            description={
              productType === "jewellery"
                ? "Total weight of the piece (gemstone specs are set per stone above)"
                : "Physical attributes and gemology details"
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {productType === "jewellery" && (
                <div className="space-y-2">
                  <label htmlFor="totalWeightGrams" className="text-sm font-medium">
                    Total weight (g)
                  </label>
                  <input
                    id="totalWeightGrams"
                    name="totalWeightGrams"
                    type="text"
                    inputMode="decimal"
                    defaultValue={product?.totalWeightGrams ?? ""}
                    placeholder="e.g. 28.48 (metal + stones)"
                    className={inputClass}
                  />
                </div>
              )}
              <div className="space-y-2">
                <label htmlFor="weightCarat" className="text-sm font-medium">
                  {productType === "jewellery"
                    ? "Total gem weight (ct)"
                    : "Weight (carat) *"}
                </label>
                <input
                  id="weightCarat"
                  name="weightCarat"
                  type="text"
                  required={productType === "loose_stone"}
                  inputMode="decimal"
                  defaultValue={product?.weightCarat ?? ""}
                  placeholder={productType === "jewellery" ? "e.g. 30.09 (stones only)" : "e.g. 2.5"}
                  className={inputClass}
                />
              </div>
              {productType === "loose_stone" && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Dimensions</label>
                    <div className="flex items-center gap-2">
                      <input
                        id="dimensionsPart1"
                        type="text"
                        inputMode="decimal"
                        maxLength={50}
                        value={dimensionsPart1}
                        onChange={(e) => setDimensionsPart1(e.target.value)}
                        placeholder="e.g. 8.2"
                        className={inputClass}
                      />
                      <span className="shrink-0 text-muted-foreground" aria-hidden>
                        ×
                      </span>
                      <input
                        id="dimensionsPart2"
                        type="text"
                        inputMode="decimal"
                        maxLength={50}
                        value={dimensionsPart2}
                        onChange={(e) => setDimensionsPart2(e.target.value)}
                        placeholder="e.g. 6.1"
                        className={inputClass}
                      />
                      <span className="shrink-0 text-muted-foreground" aria-hidden>
                        ×
                      </span>
                      <input
                        id="dimensionsPart3"
                        type="text"
                        inputMode="decimal"
                        maxLength={50}
                        value={dimensionsPart3}
                        onChange={(e) => setDimensionsPart3(e.target.value)}
                        placeholder="e.g. 4.0"
                        className={inputClass}
                      />
                      <span className="shrink-0 text-muted-foreground" aria-hidden>mm</span>
                    </div>
                    <input
                      type="hidden"
                      name="dimensions"
                      value={[dimensionsPart1, dimensionsPart2, dimensionsPart3].filter(Boolean).join(" × ") || ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="shape" className="text-sm font-medium">
                      Shape
                    </label>
                    <select
                      id="shape"
                      name="shape"
                      defaultValue={product?.shape ?? ""}
                      className={inputClass}
                    >
                      <option value="">Select shape</option>
                      {SHAPES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              {productType === "loose_stone" && (
                <>
                  <div className="space-y-2">
                    <label htmlFor="color" className="text-sm font-medium">
                      Color *
                    </label>
                    <input
                      id="color"
                      name="color"
                      type="text"
                      required
                      maxLength={100}
                      defaultValue={product?.color ?? ""}
                      placeholder="e.g. Pigeon Blood Red"
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="origin" className="text-sm font-medium">
                      Origin *
                    </label>
                    <select
                      id="origin"
                      name="origin"
                      required
                      defaultValue={product?.origin ?? ""}
                      className={inputClass}
                    >
                      <option value="">Select origin</option>
                      {(origins ?? []).map((o) => (
                        <option key={o.id} value={o.name}>
                          {o.name}
                          {o.country ? ` (${o.country})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
          </FormSection>

          <FormSection
            title="Certification"
            description="Lab reports and authenticity documentation"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <label htmlFor="laboratoryId" className="text-sm font-medium">
                  Laboratory
                </label>
                <select
                  id="laboratoryId"
                  name="laboratoryId"
                  key={productType}
                  defaultValue={product?.laboratoryId ?? ""}
                  className={inputClass}
                >
                  <option value="">
                    Select laboratory name
                  </option>
                  {(laboratories ?? []).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">Certificate</span>
                  <label
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg border border-[var(--form-input-border)] bg-[var(--form-bg)] px-3 py-2 text-sm font-medium text-[var(--form-foreground)]",
                      uploadingCertificate
                        ? "cursor-not-allowed opacity-60 pointer-events-none"
                        : "cursor-pointer hover:bg-[var(--form-muted)]"
                    )}
                  >
                    <FileText className="h-4 w-4" />
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
                <input type="hidden" name="certReportUrl" value={certReportUrl} />
                <p className="text-xs text-[var(--form-muted-foreground)]">
                  PDF or image (JPEG, PNG, WebP, GIF). Max 10 MB.
                </p>
                {certReportUrl ? (
                  <CertificateViewer
                    url={certReportUrl}
                    onRemove={() => setCertReportUrl("")}
                  />
                ) : null}

                <div className="space-y-2">
                  <label htmlFor="certNotes" className="text-sm font-medium">
                    Notes
                  </label>
                  <textarea
                    id="certNotes"
                    name="description"
                    rows={4}
                    maxLength={5000}
                    defaultValue={product?.description ?? ""}
                    placeholder="Add notes about this product / certificate..."
                    className="w-full resize-y rounded-lg border border-[var(--form-input-border)] bg-[var(--form-bg)] px-3.5 py-2.5 text-sm text-[var(--form-foreground)] placeholder:text-[var(--form-muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--form-focus-ring)] focus:ring-offset-0"
                  />
                </div>
              </div>
            </div>
          </FormSection>

          <FormSection
            title="Images"
            description={`Product photos. Upload files (max ${MAX_PRODUCT_IMAGES}).`}
          >
            <input type="hidden" name="imageUrls" value={imageUrlsList.join("\n")} />
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">
                  Upload images <span className="text-[var(--form-muted-foreground)] font-normal">(max {MAX_PRODUCT_IMAGES})</span>
                </span>
                <label
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border border-[var(--form-input-border)] bg-[var(--form-bg)] px-3 py-1.5 text-sm font-medium text-[var(--form-foreground)]",
                    uploadingImages || imageUrlsList.length >= MAX_PRODUCT_IMAGES
                      ? "cursor-not-allowed opacity-60 pointer-events-none"
                      : "cursor-pointer hover:bg-[var(--form-muted)]"
                  )}
                >
                  <Upload className="h-4 w-4" />
                  Upload images {imageUrlsList.length > 0 && `(${imageUrlsList.length}/${MAX_PRODUCT_IMAGES})`}
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
                {uploadingImages && (
                  <span className="text-sm text-[var(--form-muted-foreground)]">Uploading…</span>
                )}
              </div>
              {uploadingImages && (
                <div className="space-y-1">
                  <div className="h-2 w-full rounded-full bg-[var(--form-muted)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--form-primary)] transition-[width] duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-[var(--form-muted-foreground)]">{uploadProgress}%</p>
                </div>
              )}
              {imageUrlsList.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {imageUrlsList.map((url, idx) => (
                    <div
                      key={`${url}-${idx}`}
                      className="relative group rounded-lg border border-[var(--form-input-border)] bg-[var(--form-muted)] overflow-hidden aspect-square"
                    >
                      <Image
                        src={url}
                        alt={`Product ${idx + 1}`}
                        fill
                        className="object-cover"
                        unoptimized={url.startsWith("blob:") || url.startsWith("data:")}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect fill='%23ddd' width='100' height='100'/%3E%3Ctext x='50' y='50' dominant-baseline='middle' text-anchor='middle' fill='%23999' font-size='12'%3EInvalid%3C/text%3E%3C/svg%3E"
                        }}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setImageUrlsList((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                        aria-label="Remove image"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </FormSection>

          <FormSection
            title="Videos"
            description={`Product videos. Upload files (max ${MAX_PRODUCT_VIDEOS}).`}
          >
            <input type="hidden" name="videoUrls" value={videoUrlsList.join("\n")} />
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">
                  Upload videos <span className="text-[var(--form-muted-foreground)] font-normal">(max {MAX_PRODUCT_VIDEOS})</span>
                </span>
                <label
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border border-[var(--form-input-border)] bg-[var(--form-bg)] px-3 py-1.5 text-sm font-medium text-[var(--form-foreground)]",
                    uploadingVideos || videoUrlsList.length >= MAX_PRODUCT_VIDEOS
                      ? "cursor-not-allowed opacity-60 pointer-events-none"
                      : "cursor-pointer hover:bg-[var(--form-muted)]"
                  )}
                >
                  <Video className="h-4 w-4" />
                  Upload videos {videoUrlsList.length > 0 && `(${videoUrlsList.length}/${MAX_PRODUCT_VIDEOS})`}
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
                {uploadingVideos && (
                  <span className="text-sm text-[var(--form-muted-foreground)]">Uploading…</span>
                )}
              </div>
              {uploadingVideos && (
                <div className="space-y-1">
                  <div className="h-2 w-full rounded-full bg-[var(--form-muted)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--form-primary)] transition-[width] duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-[var(--form-muted-foreground)]">{uploadProgress}%</p>
                </div>
              )}
              {videoUrlsList.length > 0 && (
                <div className="space-y-4">
                  {videoUrlsList.map((url, idx) => (
                    <div
                      key={`${url}-${idx}`}
                      className="relative group rounded-lg border border-[var(--form-input-border)] bg-[var(--form-muted)] overflow-hidden"
                    >
                      <video
                        src={url}
                        controls
                        className="w-full max-h-[280px] bg-black"
                        preload="metadata"
                        playsInline
                      >
                        Your browser does not support the video tag.
                      </video>
                      <button
                        type="button"
                        onClick={() =>
                          setVideoUrlsList((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                        aria-label="Remove video"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </FormSection>

            {/* Notes / Extra Info tabs */}
            <div className="rounded-xl border border-[var(--form-section-border)] bg-[var(--form-section-bg)] p-6 shadow-[var(--form-shadow)]">
              <div className="flex gap-1 border-b border-[var(--form-border)]">
                <button
                  type="button"
                  onClick={() => setNotesTab("notes")}
                  className={cn(
                    "border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                    notesTab === "notes"
                      ? "border-[var(--form-primary)] text-[var(--form-foreground)]"
                      : "-mb-px border-transparent text-[var(--form-muted-foreground)] hover:text-[var(--form-foreground)]"
                  )}
                >
                  Description
                </button>
                <button
                  type="button"
                  onClick={() => setNotesTab("extra")}
                  className={cn(
                    "border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                    notesTab === "extra"
                      ? "border-[var(--form-primary)] text-[var(--form-foreground)]"
                      : "-mb-px border-transparent text-[var(--form-muted-foreground)] hover:text-[var(--form-foreground)]"
                  )}
                >
                  Extra Info
                </button>
              </div>
              <div className="pt-4">
                {notesTab === "notes" && (
                  <p className="text-sm text-[var(--form-muted-foreground)]">
                    Notes are saved in the Certification section above.
                  </p>
                )}
                {notesTab === "extra" && (
                  <p className="text-sm text-[var(--form-muted-foreground)]">Additional details can be added here.</p>
                )}
              </div>
            </div>

            {(error || uploadError) && (
              <p className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error || uploadError}
              </p>
            )}
          </form>
        </div>

        {/* Right pane: Activity sidebar */}
        <aside className="hidden lg:block lg:min-w-0 border-l border-[var(--form-border)] bg-[var(--form-sidebar-bg)]">
          <div className="flex gap-1 border-b border-[var(--form-border)] p-2">
            <button
              type="button"
              onClick={() => setSidebarTab("message")}
              className={cn(
                "flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                sidebarTab === "message"
                  ? "bg-[var(--form-primary)] text-[var(--form-primary-foreground)]"
                  : "text-[var(--form-muted-foreground)] hover:bg-[var(--form-muted)] hover:text-[var(--form-foreground)]"
              )}
            >
              Send message
            </button>
            <button
              type="button"
              onClick={() => setSidebarTab("note")}
              className={cn(
                "flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                sidebarTab === "note"
                  ? "bg-[var(--form-primary)] text-[var(--form-primary-foreground)]"
                  : "text-[var(--form-muted-foreground)] hover:bg-[var(--form-muted)] hover:text-[var(--form-foreground)]"
              )}
            >
              Log note
            </button>
            <button
              type="button"
              onClick={() => setSidebarTab("activity")}
              className={cn(
                "flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                sidebarTab === "activity"
                  ? "bg-[var(--form-primary)] text-[var(--form-primary-foreground)]"
                  : "text-[var(--form-muted-foreground)] hover:bg-[var(--form-muted)] hover:text-[var(--form-foreground)]"
              )}
            >
              Activity
            </button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-4">
            {sidebarTab === "activity" && (
              <div className="space-y-4 text-sm">
                <p className="text-[var(--form-muted-foreground)]">No activity yet.</p>
                <div className="rounded-xl border border-[var(--form-section-border)] bg-[var(--form-section-bg)] p-4 shadow-[var(--form-shadow)]">
                  <div className="flex gap-3">
                    <div className="h-9 w-9 shrink-0 rounded-full bg-[var(--form-muted)]" />
                    <div>
                      <div className="font-medium text-[var(--form-foreground)]">Stage changed</div>
                      <div className="mt-0.5 text-xs text-[var(--form-muted-foreground)]">New → Active</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {sidebarTab === "message" && (
              <p className="text-sm text-[var(--form-muted-foreground)]">Send a message to the seller or internal note.</p>
            )}
            {sidebarTab === "note" && (
              <p className="text-sm text-[var(--form-muted-foreground)]">Log an internal note for this product.</p>
            )}
          </div>
        </aside>
      </div>
    </Card>
  )
}
