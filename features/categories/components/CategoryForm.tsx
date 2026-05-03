"use client"

import { useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AdminFormSection,
  AdminFormError,
  adminInput,
  adminSelect,
  adminLabel,
  adminFieldClass,
} from "@/components/admin/admin-ui"
import { createCategoryAction, updateCategoryAction } from "@/features/categories/actions/categories"
import type { CategoryRow } from "@/features/categories/db/categories"

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
    if (!file) { setImageUrl(""); return }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImageUploadError(`Allowed types: ${ALLOWED_IMAGE_TYPES.join(", ")}`); e.target.value = ""; return
    }
    if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      setImageUploadError(`Max size: ${MAX_IMAGE_SIZE_MB} MB`); e.target.value = ""; return
    }
    const fd = new FormData()
    fd.set("file", file)
    setUploadingImage(true)
    try {
      const res = await fetch("/api/categories/image", { method: "POST", body: fd, credentials: "include" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setImageUploadError(data?.error ?? "Upload failed"); e.target.value = ""; return }
      const url = data?.url
      if (url) { setImageUrl(url) } else { setImageUploadError("Upload failed") }
      e.target.value = ""
    } catch {
      setImageUploadError("Upload failed"); e.target.value = ""
    } finally {
      setUploadingImage(false)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    if (isEdit && category) formData.set("id", category.id)
    if (imageUrl.trim()) formData.set("image", imageUrl.trim())
    const result = isEdit ? await updateCategoryAction(formData) : await createCategoryAction(formData)
    if (result?.error) { setError(result.error); setLoading(false); return }
    router.push("/admin/categories")
  }

  return (
    <div className="max-w-lg space-y-5">
      <form onSubmit={handleSubmit}>
        <AdminFormSection
          title={isEdit ? "Edit category" : "New category"}
          description={isEdit ? "Update category details" : "Add a loose stone or jewellery category"}
        >
          <div className="space-y-4">
            {/* Image upload */}
            <div className={adminFieldClass}>
              <label className={adminLabel}>Category image</label>
              <div className="flex flex-wrap items-center gap-2">
                <label
                  className={
                    "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 " +
                    (uploadingImage ? "cursor-not-allowed opacity-60 pointer-events-none" : "cursor-pointer hover:bg-slate-50")
                  }
                >
                  <Upload className="h-4 w-4" />
                  {uploadingImage ? "Uploading…" : "Upload image"}
                  <input
                    type="file" accept={ALLOWED_IMAGE_TYPES.join(",")}
                    className="sr-only" disabled={uploadingImage} onChange={handleImageChange}
                  />
                </label>
              </div>
              {imageUrl && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg ring-1 ring-slate-200">
                    <Image src={imageUrl} alt="" fill className="object-cover"
                      unoptimized={imageUrl.startsWith("blob:") || imageUrl.startsWith("data:")} sizes="48px" />
                  </div>
                  <span className="text-xs text-slate-500">
                    {isEdit && imageUrl !== (category?.image ?? "") ? "New image will be saved" : "Current category image"}
                  </span>
                </div>
              )}
              {imageUploadError && <p className="text-xs text-red-600">{imageUploadError}</p>}
              <input type="hidden" name="image" value={imageUrl ?? ""} />
            </div>

            <div className={adminFieldClass}>
              <label htmlFor="name" className={adminLabel}>Name *</label>
              <input id="name" name="name" type="text" required maxLength={100}
                defaultValue={category?.name ?? ""} placeholder="e.g. Ruby, Ring" className={adminInput} />
            </div>

            <div className={adminFieldClass}>
              <label htmlFor="shortCode" className={adminLabel}>Short code *</label>
              <input id="shortCode" name="shortCode" type="text" required maxLength={20}
                defaultValue={category?.shortCode ?? ""} placeholder="e.g. RUBY" className={adminInput} />
            </div>

            <div className={adminFieldClass}>
              <label htmlFor="type" className={adminLabel}>Type *</label>
              <select id="type" name="type" required defaultValue={category?.type ?? "loose_stone"} className={adminSelect}>
                <option value="loose_stone">Loose stone</option>
                <option value="jewellery">Jewellery</option>
              </select>
            </div>

            <div className={adminFieldClass}>
              <label htmlFor="sortOrder" className={adminLabel}>Sort order</label>
              <input id="sortOrder" name="sortOrder" type="number" min={0}
                defaultValue={category?.sortOrder ?? 0} className={adminInput} />
            </div>
          </div>
        </AdminFormSection>

        <AdminFormError error={error} />

        <div className="mt-5 flex gap-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Saving…" : isEdit ? "Update" : "Create"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/admin/categories">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
