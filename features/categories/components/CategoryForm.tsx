"use client"

import { useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { createCategoryAction, updateCategoryAction } from "@/features/categories/actions/categories"
import type { CategoryRow } from "@/features/categories/db/categories"
import { Upload } from "lucide-react"

const inputClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
const MAX_IMAGE_SIZE_MB = 5

type Props = {
  mode: "create" | "edit"
  category?: CategoryRow | null
}

export function CategoryForm({ mode, category }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [imageUrl, setImageUrl] = useState<string>(category?.image ?? "")
  const [imageUploadError, setImageUploadError] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const isEdit = mode === "edit"

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    setImageUploadError(null)
    const file = e.target.files?.[0]
    if (!file) {
      setImageUrl("")
      return
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImageUploadError(`Allowed types: ${ALLOWED_IMAGE_TYPES.join(", ")}`)
      e.target.value = ""
      return
    }
    if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      setImageUploadError(`Max size: ${MAX_IMAGE_SIZE_MB} MB`)
      e.target.value = ""
      return
    }

    const fd = new FormData()
    fd.set("file", file)
    setUploadingImage(true)
    try {
      const res = await fetch("/api/categories/image", {
        method: "POST",
        body: fd,
        credentials: "include",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setImageUploadError(data?.error ?? "Upload failed")
        e.target.value = ""
        return
      }
      const url = data?.url
      if (url) {
        setImageUrl(url)
      } else {
        setImageUploadError("Upload failed")
      }
      e.target.value = ""
    } catch {
      setImageUploadError("Upload failed")
      e.target.value = ""
    } finally {
      setUploadingImage(false)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const form = e.currentTarget
    const formData = new FormData(form)
    if (isEdit && category) formData.set("id", category.id)
    if (imageUrl.trim()) formData.set("image", imageUrl.trim())

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
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">Category image</span>
            <label
              className={
                "inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-1.5 text-sm font-medium " +
                (uploadingImage
                  ? "cursor-not-allowed opacity-60 pointer-events-none"
                  : "cursor-pointer hover:bg-muted")
              }
            >
              <Upload className="h-4 w-4" />
              {uploadingImage ? "Uploading…" : "Upload image"}
              <input
                type="file"
                accept={ALLOWED_IMAGE_TYPES.join(",")}
                className="sr-only"
                disabled={uploadingImage}
                onChange={handleImageChange}
              />
            </label>
            {uploadingImage && (
              <span className="text-sm text-muted-foreground">Uploading…</span>
            )}
          </div>
          {imageUrl && (
            <div className="flex items-center gap-2">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md ring-1 ring-border">
                <Image
                  src={imageUrl}
                  alt=""
                  fill
                  className="object-cover"
                  unoptimized={imageUrl.startsWith("blob:") || imageUrl.startsWith("data:")}
                  sizes="48px"
                />
              </div>
              <span className="text-muted-foreground text-xs">
                {isEdit && imageUrl !== (category?.image ?? "")
                  ? "New image will be saved"
                  : "Current category image"}
              </span>
            </div>
          )}
          {imageUploadError && (
            <p className="text-destructive text-xs">{imageUploadError}</p>
          )}
          <input type="hidden" name="image" value={imageUrl ?? ""} />
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
        </div>
        <div className="space-y-2">
          <label htmlFor="shortCode" className="text-sm font-medium">
            Short Code
          </label>
          <input
            id="shortCode"
            name="shortCode"
            type="text"
            defaultValue={category?.shortCode ?? ""}
            placeholder="e.g. RUBY, RING"
            maxLength={20}
            className={inputClass}
            required
          />
        </div>
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
