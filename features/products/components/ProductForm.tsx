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
import { createProductAction, updateProductAction } from "@/features/products/actions/products"
import type { ProductForEdit } from "@/features/products/db/products"
import type { CategoryOption } from "@/features/products/db/products"

const inputClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"

type Props = {
  mode: "create" | "edit"
  product?: ProductForEdit | null
  categories: CategoryOption[]
}

export function ProductForm({ mode, product, categories }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const isEdit = mode === "edit"

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
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {isEdit && (
            <input
              type="hidden"
              name="productId"
              value={product?.id ?? ""}
            />
          )}

          <div className="space-y-2">
            <label
              htmlFor="title"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
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
            <label
              htmlFor="description"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label
                htmlFor="price"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
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
              <label
                htmlFor="currency"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
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
          </div>

          <div className="space-y-2">
            <label
              htmlFor="categoryId"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Category
            </label>
            <select
              id="categoryId"
              name="categoryId"
              defaultValue={product?.categoryId ?? ""}
              className={inputClass}
            >
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label
                htmlFor="condition"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
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
              <label
                htmlFor="location"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
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

          <div className="space-y-2">
            <label
              htmlFor="imageUrls"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
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
