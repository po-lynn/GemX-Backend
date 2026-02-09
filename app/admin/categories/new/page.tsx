import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CategoryForm } from "@/features/categories/components"
import {
  getCachedCategories,
  getCachedSpecies,
} from "@/features/categories/db/cache/categories"
import { ChevronLeft } from "lucide-react"

export default async function AdminCategoriesNewPage() {
  const [categories, species] = await Promise.all([
    getCachedCategories(),
    getCachedSpecies(),
  ])

  return (
    <div className="container my-6 space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/categories">
            <ChevronLeft className="size-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New Category</h1>
          <p className="text-muted-foreground text-sm">
            Add a root category or subcategory
          </p>
        </div>
      </div>

      <CategoryForm
        mode="create"
        parentOptions={categories}
        species={species}
      />
    </div>
  )
}
