import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getCachedCategoriesTree } from "@/features/categories/db/cache/categories"
import { CategoriesTable } from "@/features/categories/components"
import { ChevronLeft, Plus } from "lucide-react"

export default async function AdminCategoriesPage() {
  const categories = await getCachedCategoriesTree()

  return (
    <div className="container my-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin">
              <ChevronLeft className="size-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Categories</h1>
            <p className="text-muted-foreground text-sm">
              Manage product categories and subcategories
            </p>
          </div>
        </div>
        <Button asChild>
          <Link href="/admin/categories/new">
            <Plus className="mr-2 size-4" />
            New Category
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Category Tree</CardTitle>
          <CardDescription>
            Create root categories or add subcategories under existing ones
          </CardDescription>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No categories yet. Create one to get started.
            </p>
          ) : (
            <CategoriesTable categories={categories} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
