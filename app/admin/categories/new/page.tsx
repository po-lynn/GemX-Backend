import { CategoryForm } from "@/features/categories/components/CategoryForm"

export default function AdminCategoriesNewPage() {
  return (
    <div className="space-y-5 py-2">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">New Category</h1>
        <p className="mt-0.5 text-sm text-slate-500">Add a loose stone or jewellery category for products</p>
      </div>
      <CategoryForm mode="create" />
    </div>
  )
}
