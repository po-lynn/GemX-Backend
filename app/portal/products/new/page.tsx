import { getAllCategories } from "@/features/categories/db/categories"
import PortalProductForm from "@/components/portal/PortalProductForm"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

export default async function NewPortalProductPage() {
  const categories = await getAllCategories()

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/portal/products"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          My products
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">New product</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Your listing will be reviewed before it goes live.
        </p>
      </div>
      <PortalProductForm categories={categories} />
    </div>
  )
}
