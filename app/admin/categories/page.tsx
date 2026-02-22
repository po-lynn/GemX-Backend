import Link from "next/link"
import { connection } from "next/server"
import { getAllCategories } from "@/features/categories/db/categories"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { CategoriesTable } from "@/features/categories/components/CategoriesTable"

export default async function AdminCategoriesPage() {
  await connection()
  const categories = await getAllCategories()

  return (
    <div className="container my-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Categories</h1>
          <p className="text-muted-foreground text-sm">
            Loose stone and jewellery categories used in products
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/categories/new">
            <Plus className="size-4" />
            Add category
          </Link>
        </Button>
      </div>

      <CategoriesTable categories={categories} />
    </div>
  )
}
