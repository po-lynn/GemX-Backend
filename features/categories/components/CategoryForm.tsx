"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { createCategoryAction, updateCategoryAction } from "@/features/categories/actions/categories"
import type { CategoryRow } from "@/features/categories/db/categories"

const inputClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"

type Props = {
  mode: "create" | "edit"
  category?: CategoryRow | null
}

export function CategoryForm({ mode, category }: Props) {
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
    if (isEdit && category) formData.set("id", category.id)

    const result = isEdit
      ? await updateCategoryAction(formData)
      : await createCategoryAction(formData)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
      return
    }
    router.push("/admin/categories")
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-6">
      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-6">
        <div className="space-y-2">
          <label htmlFor="type" className="text-sm font-medium">
            Type
          </label>
          <select
            id="type"
            name="type"
            defaultValue={category?.type ?? "loose_stone"}
            className={inputClass}
            required
          >
            <option value="loose_stone">Loose stone</option>
            <option value="jewellery">Jewellery</option>
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium">
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            defaultValue={category?.name ?? ""}
            placeholder="e.g. Ruby, Ring"
            maxLength={100}
            className={inputClass}
            required
          />
          <p className="text-xs text-muted-foreground">
            Slug is auto-generated from the name (e.g. Ruby → ruby).
          </p>
        </div>
        <div className="space-y-2">
          <label htmlFor="sortOrder" className="text-sm font-medium">
            Sort order
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
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? "Saving…" : isEdit ? "Update" : "Create"}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/admin/categories">Cancel</Link>
        </Button>
      </div>
    </form>
  )
}
