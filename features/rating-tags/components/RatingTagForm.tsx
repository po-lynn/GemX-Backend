"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  AdminFormSection,
  AdminFormError,
  adminInput,
  adminSelect,
  adminLabel,
  adminFieldClass,
} from "@/components/admin/admin-ui"
import {
  createRatingTagAction,
  updateRatingTagAction,
} from "@/features/rating-tags/actions/rating-tags"
import type { RatingTagForEdit } from "@/features/rating-tags/db/rating-tags"

type Props = {
  mode: "create" | "edit"
  ratingTag?: RatingTagForEdit | null
}

export function RatingTagForm({ mode, ratingTag }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const isEdit = mode === "edit"

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    try {
      const result = isEdit
        ? await updateRatingTagAction(formData)
        : await createRatingTagAction(formData)
      if (result?.error) {
        setError(result.error)
        return
      }
      router.push("/admin/settings/rating-tags")
      router.refresh()
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <form onSubmit={handleSubmit}>
        {isEdit && ratingTag && (
          <input type="hidden" name="ratingTagId" value={ratingTag.id} />
        )}
        <AdminFormSection
          title={isEdit ? "Edit rating tag" : "New rating tag"}
          description={
            isEdit
              ? "Update name, sentiment type, and visibility"
              : "Preset tag buyers can pick when rating sellers"
          }
        >
          <div className="space-y-4">
            <div className={adminFieldClass}>
              <label htmlFor="name" className={adminLabel}>
                Name *
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                maxLength={200}
                defaultValue={ratingTag?.name ?? ""}
                placeholder="e.g. Fast shipping"
                className={adminInput}
              />
            </div>

            <div className={adminFieldClass}>
              <label htmlFor="type" className={adminLabel}>
                Type *
              </label>
              <select
                id="type"
                name="type"
                required
                defaultValue={ratingTag?.type ?? "positive"}
                className={adminSelect}
              >
                <option value="positive">Positive</option>
                <option value="negative">Negative</option>
              </select>
            </div>

            <div className={`${adminFieldClass} flex items-center gap-2`}>
              <input
                id="isActive"
                name="isActive"
                type="checkbox"
                defaultChecked={ratingTag?.isActive ?? true}
                className="size-4 rounded border-slate-300"
              />
              <label htmlFor="isActive" className={adminLabel + " mb-0 cursor-pointer"}>
                Visible to users (uncheck to hide without deleting)
              </label>
            </div>
          </div>
        </AdminFormSection>

        <AdminFormError error={error} />

        <div className="mt-5 flex gap-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Saving…" : isEdit ? "Update" : "Create"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/admin/settings/rating-tags">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
