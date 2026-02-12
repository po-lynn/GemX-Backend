import Link from "next/link"
import { notFound } from "next/navigation"
import { CategoryForm } from "@/features/categories/components/CategoryForm"
import { getCategoryById } from "@/features/categories/db/categories"
import { Button } from "@/components/ui/button"
import { ChevronLeft } from "lucide-react"

type Props = {
  params: Promise<{ id: string }>
}

export default async function AdminCategoriesEditPage({ params }: Props) {
  const { id } = await params
  const category = await getCategoryById(id)

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
          <h1 className="text-2xl font-semibold tracking-tight">Edit Category</h1>
          <p className="text-muted-foreground text-sm">{category.name}</p>
        </div>
      </div>

      <CategoryForm mode="edit" category={category} />
    </div>
  )
}
