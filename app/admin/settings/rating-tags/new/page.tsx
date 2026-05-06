import { RatingTagForm } from "@/features/rating-tags/components"

export default function AdminRatingTagNewPage() {
  return (
    <div className="space-y-5 py-2">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          New rating tag
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Add a preset tag for buyer seller ratings
        </p>
      </div>
      <RatingTagForm key="create" mode="create" />
    </div>
  )
}
