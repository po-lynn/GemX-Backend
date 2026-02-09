import Link from "next/link"
import { Suspense } from "react"
import { Button } from "@/components/ui/button"
import { CategoryForm } from "@/features/categories/components"
import {
  getCachedCategory,
  getCachedCategories,
  getCachedSpecies,
} from "@/features/categories/db/cache/categories"
import { ChevronLeft } from "lucide-react"
import { notFound } from "next/navigation"

type Props = {
  params: Promise<{ id: string }>
}

async function AdminCategoriesEditContent({ params }: Props) {
  const { id } = await params

  const [category, categories, species] = await Promise.all([
    getCachedCategory(id),
    getCachedCategories(),
    getCachedSpecies(),
  ])

  if (!category) notFound()

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
          <h1 className="text-2xl font-semibold tracking-tight">
            Edit Category
          </h1>
          <p className="text-muted-foreground text-sm">
            Update {category.name}
          </p>
        </div>
      </div>

      <CategoryForm
        mode="edit"
        category={category}
        parentOptions={categories}
        species={species}
      />
    </div>
  )
}

export default function AdminCategoriesEditPage(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="container my-6 animate-pulse space-y-4 rounded-lg bg-muted/30 p-6">
          Loading...
        </div>
      }
    >
      <AdminCategoriesEditContent {...props} />
    </Suspense>
  )
}
