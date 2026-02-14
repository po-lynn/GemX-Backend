"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
import { Eye, Pencil, Trash2 } from "lucide-react"

const inputClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"

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
    <section className="rounded-xl border border-border bg-muted/20 p-6">
      <div className="mb-6 flex items-start gap-4">
        <div
          className="mt-0.5 h-8 w-0.5 shrink-0 rounded-full bg-primary/70"
          aria-hidden
        />
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

const SHAPES = ["Oval", "Cushion", "Round", "Pear", "Heart"] as const
const TREATMENTS = ["None", "Heated", "Oiled", "Glass Filled"] as const

const STATUS_OPTIONS = [
  { value: "active", label: "Active", color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" },
  { value: "archive", label: "Archive", color: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30" },
  { value: "sold", label: "Sold", color: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30" },
  { value: "hidden", label: "Hidden", color: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" },
] as const

import type { CategoryRow } from "@/features/categories/db/categories"

type Props = {
  mode: "create" | "edit"
  product?: ProductForEdit | null
  categories: CategoryRow[]
}

import type { LaboratoryOption } from "@/features/laboratory/db/laboratory"

type LabProps = {
  mode: "create" | "edit"
  product?: ProductForEdit | null
  laboratories?: LaboratoryOption[] | null
}

function parseDimensions(value: string | null | undefined): [string, string, string] {
  if (!value?.trim()) return ["", "", ""]
  const parts = value.trim().split(/\s*[x×]\s*/i).map((s) => s.trim())
  return [parts[0] ?? "", parts[1] ?? "", parts[2] ?? ""]
}

export function ProductForm({ mode, product, categories, laboratories }: Props & LabProps) {
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
  /** Form state: all string for inputs; maps to JewelleryGemstoneItem when submitting. */
  type FormGemstoneEntry = {
    categoryId: string
    weightCarat: string
    dimensions: string
    color: string
    shape: string
    treatment: string
    origin: string
    cut: string
    transparency: string
    comment: string
    inclusions: string
    certReportNumber: string
    certReportDate: string
    certLabName: string
    categoryName?: string
  }
  const emptyGemstone = (): FormGemstoneEntry => ({
    categoryId: "",
    weightCarat: "",
    dimensions: "",
    color: "",
    shape: "",
    treatment: "",
    origin: "",
    cut: "",
    transparency: "",
    comment: "",
    inclusions: "",
    certReportNumber: "",
    certReportDate: "",
    certLabName: "",
  })
  const [jewelleryGemstones, setJewelleryGemstones] = useState<FormGemstoneEntry[]>(
    (product?.jewelleryGemstones ?? []).map((g) => ({
      categoryId: g.categoryId,
      weightCarat: g.weightCarat,
      dimensions: g.dimensions ?? "",
      color: g.color ?? "",
      shape: g.shape ?? "",
      treatment: g.treatment ?? "",
      origin: g.origin ?? "",
      cut: g.cut ?? "",
      transparency: g.transparency ?? "",
      comment: g.comment ?? "",
      inclusions: g.inclusions ?? "",
      certReportNumber: g.certReportNumber ?? "",
      certReportDate: g.certReportDate ?? "",
      certLabName: g.certLabName ?? "",
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
              dimensions: g.dimensions.trim() || null,
              color: g.color.trim() || null,
              shape: g.shape || null,
              treatment: g.treatment || null,
              origin: g.origin.trim() || null,
              cut: g.cut.trim() || null,
              transparency: g.transparency.trim() || null,
              comment: g.comment.trim() || null,
              inclusions: g.inclusions.trim() || null,
              certReportNumber: g.certReportNumber.trim() || null,
              certReportDate: g.certReportDate.trim() || null,
              certLabName: g.certLabName.trim() || null,
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

  const statusOpt = STATUS_OPTIONS.find((o) => o.value === status)

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border pb-6">
        <div>
          <CardTitle>{isEdit ? "Edit Product" : "New Product"}</CardTitle>
          <CardDescription>
            {isEdit
              ? "Update product details"
              : "Add a new product to the marketplace"}
          </CardDescription>
        </div>
        <Badge
          variant="outline"
          className={`shrink-0 font-medium ${statusOpt?.color ?? ""}`}
        >
          {statusOpt?.label ?? status}
        </Badge>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
          {isEdit && (
            <input
              type="hidden"
              name="productId"
              value={product?.id ?? ""}
            />
          )}

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
            {isEdit && product?.sku && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  SKU
                </label>
                <p
                  className="rounded-md border border-border bg-muted/50 px-3 py-2 font-mono text-sm"
                  aria-label={`SKU: ${product.sku}`}
                >
                  {product.sku}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={4}
                maxLength={5000}
                defaultValue={product?.description ?? ""}
                placeholder={
                  productType === "jewellery"
                    ? "e.g. Set contents: 1 Necklace, 2 Earrings, 1 Maang Tikka. Describe style (e.g. Noratan bridal), craftsmanship, and condition."
                    : "Product description"
                }
                className={inputClass + " min-h-[80px] resize-y"}
              />
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
                  Product type
                </label>
                <select
                  id="productType"
                  name="productType"
                  value={productType}
                  onChange={(e) =>
                    setProductType(e.target.value as "loose_stone" | "jewellery")
                  }
                  className={inputClass}
                >
                  <option value="loose_stone">Loose stone</option>
                  <option value="jewellery">Jewellery</option>
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="categoryId" className="text-sm font-medium">
                  Category
                </label>
                <select
                  id="categoryId"
                  name="categoryId"
                  key={productType}
                  defaultValue={product?.categoryId ?? ""}
                  className={inputClass}
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
                    <label className="text-xs font-medium">Weight (ct)</label>
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
                    <label className="text-xs font-medium">Color</label>
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
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Treatment</label>
                    <select
                      className={inputClass}
                      value={gemstoneDialogForm.treatment}
                      onChange={(e) =>
                        setGemstoneDialogForm((prev) => ({ ...prev, treatment: e.target.value }))
                      }
                      disabled={gemstoneDialogMode === "view"}
                    >
                      <option value="">Select</option>
                      {TREATMENTS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-medium">Origin</label>
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
                  <p className="text-xs font-medium text-muted-foreground sm:col-span-2 mt-2">From gem report</p>
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
                  <p className="text-xs font-medium text-muted-foreground sm:col-span-2 mt-2">Certification (report)</p>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Lab name</label>
                    <input
                      type="text"
                      placeholder="e.g. AGGL, GRS Gemresearch Swisslab"
                      className={inputClass}
                      value={gemstoneDialogForm.certLabName}
                      onChange={(e) =>
                        setGemstoneDialogForm((prev) => ({ ...prev, certLabName: e.target.value }))
                      }
                      disabled={gemstoneDialogMode === "view"}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Report number</label>
                    <input
                      type="text"
                      placeholder="e.g. J202007463, GRS2025-080552"
                      className={inputClass}
                      value={gemstoneDialogForm.certReportNumber}
                      onChange={(e) =>
                        setGemstoneDialogForm((prev) => ({ ...prev, certReportNumber: e.target.value }))
                      }
                      disabled={gemstoneDialogMode === "view"}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Report date</label>
                    <input
                      type="text"
                      placeholder="e.g. 2024-09-17"
                      className={inputClass}
                      value={gemstoneDialogForm.certReportDate}
                      onChange={(e) =>
                        setGemstoneDialogForm((prev) => ({ ...prev, certReportDate: e.target.value }))
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
                          !gemstoneDialogForm.categoryId || gemstoneDialogForm.weightCarat.trim() === ""
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
              <div className="space-y-2">
                <label htmlFor="weightCarat" className="text-sm font-medium">
                  {productType === "jewellery"
                    ? "Total weight (carat)"
                    : "Weight (carat)"}
                </label>
                <input
                  id="weightCarat"
                  name="weightCarat"
                  type="text"
                  inputMode="decimal"
                  defaultValue={product?.weightCarat ?? ""}
                  placeholder={productType === "jewellery" ? "e.g. 3.2 (total piece)" : "e.g. 2.5"}
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
                    <label htmlFor="color" className="text-sm font-medium">
                      Color
                    </label>
                    <input
                      id="color"
                      name="color"
                      type="text"
                      maxLength={100}
                      defaultValue={product?.color ?? ""}
                      placeholder="e.g. Pigeon Blood Red"
                      className={inputClass}
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
                  <div className="space-y-2">
                    <label htmlFor="treatment" className="text-sm font-medium">
                      Treatment
                    </label>
                    <select
                      id="treatment"
                      name="treatment"
                      defaultValue={product?.treatment ?? ""}
                      className={inputClass}
                    >
                      <option value="">Select treatment</option>
                      {TREATMENTS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="origin" className="text-sm font-medium">
                      Origin
                    </label>
                    <input
                      id="origin"
                      name="origin"
                      type="text"
                      maxLength={200}
                      defaultValue={product?.origin ?? ""}
                      placeholder="e.g. Mogok, Myanmar"
                      className={inputClass}
                    />
                  </div>
                </>
              )}
            </div>
          </FormSection>

          <FormSection
            title="Status & Visibility"
            description="Listing status and featured placement"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="status" className="text-sm font-medium">
                  Status
                </label>
                <select
                  id="status"
                  name="status"
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as "active" | "archive" | "sold" | "hidden")
                  }
                  className={inputClass}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end gap-2 pb-2">
                <input
                  id="isFeatured"
                  name="isFeatured"
                  type="checkbox"
                  defaultChecked={product?.isFeatured ?? false}
                  className="size-4 rounded border-input"
                />
                <label htmlFor="isFeatured" className="text-sm font-medium">
                  Featured
                </label>
              </div>
            </div>
          </FormSection>

          {productType === "loose_stone" && (
            <FormSection
              title="Certification"
              description="Lab reports and authenticity documentation"
            >
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
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
                  <label htmlFor="certReportNumber" className="text-sm font-medium">
                    Report number
                  </label>
                  <input
                    id="certReportNumber"
                    name="certReportNumber"
                    type="text"
                    maxLength={100}
                    defaultValue={product?.certReportNumber ?? ""}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="certReportDate" className="text-sm font-medium">
                    Report date
                  </label>
                  <input
                    id="certReportDate"
                    name="certReportDate"
                    type="text"
                    maxLength={50}
                    defaultValue={product?.certReportDate ?? ""}
                    placeholder="e.g. 2024-09-17"
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="certReportUrl" className="text-sm font-medium">
                    Report URL
                  </label>
                  <input
                    id="certReportUrl"
                    name="certReportUrl"
                    type="url"
                    maxLength={500}
                    defaultValue={product?.certReportUrl ?? ""}
                    placeholder="https://..."
                    className={inputClass}
                  />
                </div>
              </div>
            </FormSection>
          )}

          <FormSection
            title="Images"
            description="Product photos and media URLs"
          >
            <div className="space-y-2">
              <label htmlFor="imageUrls" className="text-sm font-medium">
                Image URLs
              </label>
              <textarea
                id="imageUrls"
                name="imageUrls"
                rows={3}
                defaultValue={product?.imageUrls?.join("\n") ?? ""}
                placeholder="One URL per line or comma-separated"
                className={inputClass + " min-h-[60px] resize-y font-mono text-sm"}
              />
            </div>
          </FormSection>

          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-3 border-t border-border pt-6">
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : isEdit ? "Update" : "Create"}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/admin/products">Cancel</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
