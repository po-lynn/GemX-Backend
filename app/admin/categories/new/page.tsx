import { requireAdmin } from "@/lib/admin-guard"
import { CategoryForm } from "@/features/categories/components/CategoryForm"
import { FadeUp } from "@/components/admin/motion"

export default async function AdminCategoriesNewPage() {
  await requireAdmin()
  return <FadeUp><CategoryForm mode="create" /></FadeUp>
}
