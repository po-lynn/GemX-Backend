import Link from "next/link"
import { connection } from "next/server"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getAllCategories } from "@/features/categories/db/categories"
import { CategoriesTable } from "@/features/categories/components/CategoriesTable"

export default async function AdminCategoriesPage() {
  await connection()
  const categories = await getAllCategories()

  return (
    <div className="space-y-5 py-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Categories</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Loose stone and jewellery categories used in products
          </p>
        </div>
        <Button asChild size="sm" className="shrink-0 shadow-sm">
          <Link href="/admin/categories/new">
            <Plus className="mr-1.5 size-4" />
            Add Category
          </Link>
        </Button>
      </div>

      <CategoriesTable categories={categories} />
    </div>
  )
}
