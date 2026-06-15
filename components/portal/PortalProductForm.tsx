"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import type { CategoryRow } from "@/features/categories/db/categories"
import { createPortalProductAction, updatePortalProductAction } from "@/features/products/actions/portal-products"

type ProductType = "loose_stone" | "jewellery"

export type PortalProductFormValues = {
  title: string
  sku: string
  description: string
  productType: ProductType
  categoryId: string
  price: string
  currency: string
  isNegotiable: boolean
  identification: string
  weightCarat: string
  color: string
  origin: string
  stoneCut: string
  shape: string
  dimensions: string
  metal: string
  totalWeightGrams: string
  pieceCount: string
  certReportNumber: string
  certReportDate: string
  certReportUrl: string
  additionalMemos: string
  imageUrls: string
  videoUrls: string
}

const EMPTY: PortalProductFormValues = {
  title: "", sku: "", description: "",
  productType: "loose_stone", categoryId: "",
  price: "", currency: "USD", isNegotiable: false,
  identification: "Natural",
  weightCarat: "", color: "", origin: "", stoneCut: "", shape: "",
  dimensions: "", metal: "", totalWeightGrams: "", pieceCount: "",
  certReportNumber: "", certReportDate: "", certReportUrl: "",
  additionalMemos: "", imageUrls: "", videoUrls: "",
}

type Props = {
  categories: CategoryRow[]
  productId?: string
  initial?: Partial<PortalProductFormValues>
}

export default function PortalProductForm({ categories, productId, initial }: Props) {
  const router = useRouter()
  const [values, setValues] = useState<PortalProductFormValues>({ ...EMPTY, ...initial })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const isEdit = Boolean(productId)
  const filteredCategories = categories.filter((c) => c.type === values.productType)

  function set<K extends keyof PortalProductFormValues>(key: K, value: PortalProductFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      const input = {
        ...values,
        imageUrls: values.imageUrls.split(/[\n,]/).map((s) => s.trim()).filter(Boolean),
        videoUrls: values.videoUrls.split(/[\n,]/).map((s) => s.trim()).filter(Boolean),
      }
      const result = isEdit
        ? await updatePortalProductAction(productId!, input)
        : await createPortalProductAction(input)
      if (!result.ok) {
        if (result.details) setErrors(Object.fromEntries(Object.entries(result.details).map(([k, v]) => [k, v[0]])))
        else setErrors({ _form: result.error })
        return
      }
      router.push("/portal/products")
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {errors._form && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errors._form}
        </div>
      )}

      {/* Basic info */}
      <section className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Basic information</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
            <Input id="title" value={values.title} onChange={(e) => set("title", e.target.value)} className="mt-1.5" />
            {errors.title && <p className="mt-1 text-xs text-destructive">{errors.title}</p>}
          </div>
          <div>
            <Label htmlFor="sku">SKU</Label>
            <Input id="sku" value={values.sku} onChange={(e) => set("sku", e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="productType">Type <span className="text-destructive">*</span></Label>
            <Select value={values.productType} onValueChange={(v) => { set("productType", v as ProductType); set("categoryId", "") }}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="loose_stone">Loose Stone</SelectItem>
                <SelectItem value="jewellery">Jewellery</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="categoryId">Category <span className="text-destructive">*</span></Label>
            <Select value={values.categoryId} onValueChange={(v) => set("categoryId", v)}>
              <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {filteredCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.categoryId && <p className="mt-1 text-xs text-destructive">{errors.categoryId}</p>}
          </div>
          <div>
            <Label htmlFor="identification">Treatment</Label>
            <Select value={values.identification} onValueChange={(v) => set("identification", v)}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Natural", "Heat Treated", "Treatments", "Others"].map((v) => (
                  <SelectItem key={v} value={v}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" value={values.description} onChange={(e) => set("description", e.target.value)} className="mt-1.5" rows={4} />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Pricing</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Label htmlFor="price">Price <span className="text-destructive">*</span></Label>
            <Input id="price" type="number" min="0" step="0.01" value={values.price} onChange={(e) => set("price", e.target.value)} className="mt-1.5" />
            {errors.price && <p className="mt-1 text-xs text-destructive">{errors.price}</p>}
          </div>
          <div>
            <Label htmlFor="currency">Currency</Label>
            <Select value={values.currency} onValueChange={(v) => set("currency", v)}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="MMK">MMK</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 sm:col-span-3">
            <input
              id="isNegotiable"
              type="checkbox"
              checked={values.isNegotiable}
              onChange={(e) => set("isNegotiable", e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="isNegotiable" className="cursor-pointer font-normal">Price is negotiable</Label>
          </div>
        </div>
      </section>

      {/* Specifications */}
      <section className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Specifications</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {values.productType === "loose_stone" && (
            <>
              <div>
                <Label htmlFor="weightCarat">Weight (carat) <span className="text-destructive">*</span></Label>
                <Input id="weightCarat" type="number" min="0" step="0.0001" value={values.weightCarat} onChange={(e) => set("weightCarat", e.target.value)} className="mt-1.5" />
                {errors.weightCarat && <p className="mt-1 text-xs text-destructive">{errors.weightCarat}</p>}
              </div>
              <div>
                <Label htmlFor="color">Color <span className="text-destructive">*</span></Label>
                <Input id="color" value={values.color} onChange={(e) => set("color", e.target.value)} className="mt-1.5" />
                {errors.color && <p className="mt-1 text-xs text-destructive">{errors.color}</p>}
              </div>
              <div>
                <Label htmlFor="origin">Origin <span className="text-destructive">*</span></Label>
                <Input id="origin" value={values.origin} onChange={(e) => set("origin", e.target.value)} className="mt-1.5" />
                {errors.origin && <p className="mt-1 text-xs text-destructive">{errors.origin}</p>}
              </div>
              <div>
                <Label htmlFor="stoneCut">Cut</Label>
                <Select value={values.stoneCut} onValueChange={(v) => set("stoneCut", v)}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select cut" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Faceted">Faceted</SelectItem>
                    <SelectItem value="Cabochon">Cabochon</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="shape">Shape</Label>
                <Select value={values.shape} onValueChange={(v) => set("shape", v)}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select shape" /></SelectTrigger>
                  <SelectContent>
                    {["Oval", "Cushion", "Round", "Pear", "Heart"].map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          {values.productType === "jewellery" && (
            <>
              <div>
                <Label htmlFor="metal">Metal</Label>
                <Select value={values.metal} onValueChange={(v) => set("metal", v)}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select metal" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Gold">Gold</SelectItem>
                    <SelectItem value="Silver">Silver</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="totalWeightGrams">Total weight (grams)</Label>
                <Input id="totalWeightGrams" type="number" min="0" step="0.01" value={values.totalWeightGrams} onChange={(e) => set("totalWeightGrams", e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="pieceCount">Piece count</Label>
                <Input id="pieceCount" type="number" min="0" step="1" value={values.pieceCount} onChange={(e) => set("pieceCount", e.target.value)} className="mt-1.5" />
              </div>
            </>
          )}
          <div>
            <Label htmlFor="dimensions">Dimensions</Label>
            <Input id="dimensions" placeholder="e.g. 10 × 8 × 5 mm" value={values.dimensions} onChange={(e) => set("dimensions", e.target.value)} className="mt-1.5" />
          </div>
        </div>
      </section>

      {/* Certification */}
      <section className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Certification (optional)</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="certReportNumber">Report number</Label>
            <Input id="certReportNumber" value={values.certReportNumber} onChange={(e) => set("certReportNumber", e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="certReportDate">Report date</Label>
            <Input id="certReportDate" value={values.certReportDate} onChange={(e) => set("certReportDate", e.target.value)} className="mt-1.5" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="certReportUrl">Report URL</Label>
            <Input id="certReportUrl" type="url" value={values.certReportUrl} onChange={(e) => set("certReportUrl", e.target.value)} className="mt-1.5" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="additionalMemos">Additional notes</Label>
            <Textarea id="additionalMemos" value={values.additionalMemos} onChange={(e) => set("additionalMemos", e.target.value)} className="mt-1.5" rows={3} />
          </div>
        </div>
      </section>

      {/* Media */}
      <section className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Media</h2>
        <div className="space-y-4">
          <div>
            <Label htmlFor="imageUrls">Image URLs (one per line, up to 10)</Label>
            <Textarea
              id="imageUrls"
              value={values.imageUrls}
              onChange={(e) => set("imageUrls", e.target.value)}
              className="mt-1.5 font-mono text-xs"
              rows={4}
              placeholder="https://..."
            />
            {errors.imageUrls && <p className="mt-1 text-xs text-destructive">{errors.imageUrls}</p>}
          </div>
          <div>
            <Label htmlFor="videoUrls">Video URLs (one per line, up to 5)</Label>
            <Textarea
              id="videoUrls"
              value={values.videoUrls}
              onChange={(e) => set("videoUrls", e.target.value)}
              className="mt-1.5 font-mono text-xs"
              rows={2}
              placeholder="https://..."
            />
          </div>
        </div>
      </section>

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.push("/portal/products")}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEdit ? "Save changes" : "Create product"}
        </Button>
      </div>
    </form>
  )
}
