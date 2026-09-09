import { requireAdmin } from "@/lib/admin-guard"
import { CategoryForm } from "@/features/categories/components/CategoryForm"
import { FadeUp } from "@/components/admin/motion"

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function AdminCategoriesNewPage() {
  await requireAdmin()
  return <FadeUp><CategoryForm mode="create" /></FadeUp>
}
