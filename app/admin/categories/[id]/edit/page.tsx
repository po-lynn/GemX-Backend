import { connection } from "next/server"
import { notFound } from "next/navigation"
import { CategoryForm } from "@/features/categories/components/CategoryForm"
import { getCategoryById } from "@/features/categories/db/categories"

type Props = {
  params: Promise<{ id: string }>
}

export default async function AdminCategoriesEditPage({ params }: Props) {
  await connection()
  const { id } = await params
  const category = await getCategoryById(id)
  if (!category) notFound()

  return (
    <div className="space-y-5 py-2">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Edit Category</h1>
        <p className="mt-0.5 text-sm text-slate-500">{category.name}</p>
      </div>
      <CategoryForm mode="edit" category={category} />
    </div>
  )
}
