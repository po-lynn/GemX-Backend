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
import {
  createCategoryAction,
  updateCategoryAction,
} from "@/features/categories/actions/categories"
import type { CategoryForEdit } from "@/features/categories/db/categories"
import type { CategoryOption, SpeciesOption } from "@/features/categories/db/categories"

const inputClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"

type Props = {
  mode: "create" | "edit"
  category?: CategoryForEdit | null
  parentOptions: CategoryOption[]
  species: SpeciesOption[]
}

export function CategoryForm({
  mode,
  category,
  parentOptions,
  species,
}: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const isEdit = mode === "edit"

  const parentChoices = useMemo(
    () =>
      isEdit && category
        ? parentOptions.filter((c) => c.id !== category.id)
        : parentOptions,
    [isEdit, category?.id, parentOptions]
  )

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const form = e.currentTarget
    const formData = new FormData(form)

    try {
      const result = isEdit
        ? await updateCategoryAction(formData)
        : await createCategoryAction(formData)

      if (result?.error) {
        setError(result.error)
        setLoading(false)
        return
      }

      router.push("/admin/categories")
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
        <CardTitle>{isEdit ? "Edit Category" : "New Category"}</CardTitle>
        <CardDescription>
          {isEdit
            ? "Update category details"
            : "Add a new category or subcategory"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {isEdit && category && (
            <input
              type="hidden"
              name="categoryId"
              value={category.id}
            />
          )}

          <section className="space-y-4">
            <h3 className="text-sm font-medium">Basic Info</h3>
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Name *
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                maxLength={100}
                defaultValue={category?.name ?? ""}
                placeholder="e.g. Loose Stones"
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="slug" className="text-sm font-medium">
                Slug
              </label>
              <input
                id="slug"
                name="slug"
                type="text"
                maxLength={100}
                defaultValue={category?.slug ?? ""}
                placeholder="Auto-generated from name if empty"
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="parentId" className="text-sm font-medium">
                Parent Category
              </label>
              <select
                id="parentId"
                name="parentId"
                className={inputClass}
                defaultValue={category?.parentId ?? ""}
              >
                <option value="">Root (no parent)</option>
                {parentChoices.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                maxLength={500}
                defaultValue={category?.description ?? ""}
                placeholder="Optional description"
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="sortOrder" className="text-sm font-medium">
                Sort Order
              </label>
              <input
                id="sortOrder"
                name="sortOrder"
                type="number"
                min={0}
                defaultValue={category?.sortOrder ?? 0}
                className={inputClass}
              />
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-medium">Species</h3>
            <p className="text-muted-foreground text-sm">
              Which gem species are available for products in this category?
            </p>
            <div className="flex flex-wrap gap-3">
              {species.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    name="speciesIds"
                    value={s.id}
                    defaultChecked={category?.speciesIds?.includes(s.id)}
                    className="size-4 rounded border-input"
                  />
                  <span className="text-sm">{s.name}</span>
                </label>
              ))}
            </div>
          </section>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : isEdit ? "Update" : "Create"}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/admin/categories">Cancel</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
