"use client"

import { useState } from "react"
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
import { createProductAction, updateProductAction } from "@/features/products/actions/products"
import type { ProductForEdit } from "@/features/products/db/products"

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

export function ProductForm({ mode, product, categories, laboratories }: Props & LabProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const isEdit = mode === "edit"

  const [productType, setProductType] = useState<"loose_stone" | "jewellery">(
    product?.productType ?? "loose_stone"
  )
  const categoryOptions = categories.filter((c) => c.type === productType)
  const [status, setStatus] = useState<"active" | "archive" | "sold" | "hidden">(
    (product?.status as "active" | "archive" | "sold" | "hidden") ?? "active"
  )

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const form = e.currentTarget
    const formData = new FormData(form)

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
                placeholder="Product description"
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
            description="Product type (loose stone or jewellery) and category"
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
              {productType === "jewellery" && (
                <>
                  <div className="space-y-2 sm:col-span-2">
                    <label htmlFor="materials" className="text-sm font-medium">
                      Materials (metals)
                    </label>
                    <input
                      id="materials"
                      name="materials"
                      type="text"
                      maxLength={500}
                      defaultValue={product?.materials ?? ""}
                      placeholder="e.g. Gold (yellow), Sterling silver"
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <label htmlFor="qualityGemstones" className="text-sm font-medium">
                      Quality / Gemstones
                    </label>
                    <input
                      id="qualityGemstones"
                      name="qualityGemstones"
                      type="text"
                      maxLength={500}
                      defaultValue={product?.qualityGemstones ?? ""}
                      placeholder="e.g. Diamonds, Sapphires"
                      className={inputClass}
                    />
                  </div>
                </>
              )}
            </div>
          </FormSection>

          <FormSection
            title="Specifications"
            description="Physical attributes and gemology details"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="weightCarat" className="text-sm font-medium">
                  Weight (carat)
                </label>
                <input
                  id="weightCarat"
                  name="weightCarat"
                  type="text"
                  inputMode="decimal"
                  defaultValue={product?.weightCarat ?? ""}
                  placeholder="e.g. 2.5"
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="dimensions" className="text-sm font-medium">
                  Dimensions
                </label>
                <input
                  id="dimensions"
                  name="dimensions"
                  type="text"
                  maxLength={100}
                  defaultValue={product?.dimensions ?? ""}
                  placeholder="e.g. 8.2 x 6.1 x 4.3 mm"
                  className={inputClass}
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
              <div className="space-y-2">
                <label htmlFor="colorGrade" className="text-sm font-medium">
                  Color grade
                </label>
                <input
                  id="colorGrade"
                  name="colorGrade"
                  type="text"
                  maxLength={50}
                  defaultValue={product?.colorGrade ?? ""}
                  placeholder="e.g. AAA, Pigeon Blood"
                  className={inputClass}
                />
              </div>
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

          <FormSection
            title="Other"
            description="Condition, location, and additional details"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="condition" className="text-sm font-medium">
                  Condition
                </label>
                <input
                  id="condition"
                  name="condition"
                  type="text"
                  maxLength={100}
                  defaultValue={product?.condition ?? ""}
                  placeholder="e.g. new, used"
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="location" className="text-sm font-medium">
                  Location
                </label>
                <input
                  id="location"
                  name="location"
                  type="text"
                  maxLength={200}
                  defaultValue={product?.location ?? ""}
                  placeholder="City or region"
                  className={inputClass}
                />
              </div>
            </div>
          </FormSection>

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
