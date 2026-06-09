import { requireAdmin } from "@/lib/admin-guard"
import { CategoryForm } from "@/features/categories/components/CategoryForm"

export default async function AdminCategoriesNewPage() {
  await requireAdmin()
  return <CategoryForm mode="create" />
}
