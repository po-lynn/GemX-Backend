import Link from "next/link"
import { CategoryForm } from "@/features/categories/components/CategoryForm"
import { Button } from "@/components/ui/button"
import { ChevronLeft } from "lucide-react"

export default function AdminCategoriesNewPage() {
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
            Add a loose stone or jewellery category for products
          </p>
        </div>
      </div>

      <CategoryForm mode="create" />
    </div>
  )
}
