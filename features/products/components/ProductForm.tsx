"use client"

import { useState, useMemo } from "react"
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
import { createProductAction, updateProductAction } from "@/features/products/actions/products"
import type { ProductForEdit } from "@/features/products/db/products"
import type { CategoryTreeNode, SpeciesOption } from "@/features/products/db/products"

const inputClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"

const SHAPES = ["Oval", "Cushion", "Round", "Pear", "Heart"] as const
const TREATMENTS = ["None", "Heated", "Oiled", "Glass Filled"] as const

type Props = {
  mode: "create" | "edit"
  product?: ProductForEdit | null
  categoryTree: CategoryTreeNode[]
  speciesByCategory: Record<string, SpeciesOption[]>
}

function findCategoryInTree(
  tree: CategoryTreeNode[],
  id: string
): { parent: CategoryTreeNode | null; node: CategoryTreeNode } | null {
  for (const node of tree) {
    if (node.id === id) return { parent: null, node }
    for (const child of node.children) {
      if (child.id === id) return { parent: node, node: child }
    }
  }
  return null
}

export function ProductForm({ mode, product, categoryTree, speciesByCategory }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const isEdit = mode === "edit"

  const initialCategory = useMemo(() => {
    if (!product?.categoryId) return { parentId: "", subcategoryId: "" }
    const found = findCategoryInTree(categoryTree, product.categoryId)
    if (!found) return { parentId: "", subcategoryId: "" }
    return found.parent
      ? { parentId: found.parent.id, subcategoryId: found.node.id }
      : { parentId: found.node.id, subcategoryId: "" }
  }, [product?.categoryId, categoryTree])

  const [parentId, setParentId] = useState(initialCategory.parentId)
  const [subcategoryId, setSubcategoryId] = useState(initialCategory.subcategoryId)

  const parentMap = useMemo(() => {
    const map = new Map<string, CategoryTreeNode>()
    for (const node of categoryTree) {
      map.set(node.id, node)
    }
    return map
  }, [categoryTree])

  const subcategories = parentId ? (parentMap.get(parentId)?.children ?? []) : []

  const categoryId = subcategoryId || parentId || ""

  const availableSpecies = categoryId ? (speciesByCategory[categoryId] ?? []) : []

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEdit ? "Edit Product" : "New Product"}</CardTitle>
        <CardDescription>
          {isEdit
            ? "Update product details"
            : "Add a new product to the marketplace"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {isEdit && (
            <input
              type="hidden"
              name="productId"
              value={product?.id ?? ""}
            />
          )}

          {/* Basic info */}
          <section className="space-y-4">
            <h3 className="text-sm font-medium">Basic Info</h3>
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
              <label htmlFor="sku" className="text-sm font-medium">
                SKU
              </label>
              <input
                id="sku"
                name="sku"
                type="text"
                maxLength={50}
                defaultValue={product?.sku ?? ""}
                placeholder="Optional SKU"
                className={inputClass}
              />
            </div>
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
          </section>

          {/* Pricing */}
          <section className="space-y-4">
            <h3 className="text-sm font-medium">Pricing</h3>
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
          </section>

          {/* Category & Species */}
          <section className="space-y-4">
            <h3 className="text-sm font-medium">Category & Species</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="parentCategoryId" className="text-sm font-medium">
                  Main Category
                </label>
                <select
                  id="parentCategoryId"
                  value={parentId}
                  onChange={(e) => {
                    setParentId(e.target.value)
                    setSubcategoryId("")
                  }}
                  className={inputClass}
                >
                  <option value="">No category</option>
                  {categoryTree.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="subcategoryId" className="text-sm font-medium">
                  Subcategory
                </label>
                <select
                  id="subcategoryId"
                  value={subcategoryId}
                  onChange={(e) => setSubcategoryId(e.target.value)}
                  disabled={!parentId}
                  className={inputClass}
                >
                  <option value="">
                    {subcategories.length > 0 ? "No subcategory" : "—"}
                  </option>
                  {subcategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="speciesId" className="text-sm font-medium">
                  Species
                </label>
                <select
                  key={categoryId}
                  id="speciesId"
                  name="speciesId"
                  defaultValue={
                    availableSpecies.some((s) => s.id === product?.speciesId)
                      ? (product?.speciesId ?? "")
                      : ""
                  }
                  disabled={!categoryId}
                  className={inputClass}
                >
                  <option value="">
                    {availableSpecies.length > 0
                      ? "No species"
                      : categoryId
                        ? "No species configured for this category"
                        : "Select category first"}
                  </option>
                  {availableSpecies.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <input type="hidden" name="categoryId" value={categoryId} />
          </section>

          {/* Specifications */}
          <section className="space-y-4">
            <h3 className="text-sm font-medium">Specifications</h3>
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
            </div>
          </section>

          {/* Certification */}
          <section className="space-y-4">
            <h3 className="text-sm font-medium">Certification</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <label htmlFor="certLabName" className="text-sm font-medium">
                  Lab name
                </label>
                <input
                  id="certLabName"
                  name="certLabName"
                  type="text"
                  maxLength={100}
                  defaultValue={product?.certLabName ?? ""}
                  className={inputClass}
                />
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
          </section>

          {/* Other */}
          <section className="space-y-4">
            <h3 className="text-sm font-medium">Other</h3>
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
          </section>

          {/* Media */}
          <section className="space-y-4">
            <h3 className="text-sm font-medium">Images</h3>
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
          </section>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex gap-2">
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
