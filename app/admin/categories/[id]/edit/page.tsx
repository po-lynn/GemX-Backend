import { connection } from "next/server"
import { notFound } from "next/navigation"
import { requireAdmin } from "@/lib/admin-guard"
import { CategoryForm } from "@/features/categories/components/CategoryForm"
import { getCategoryById } from "@/features/categories/db/categories"
import { FadeUp } from "@/components/admin/motion"
import { resolveAdjacentCategories } from "./resolve-adjacent"

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

type Props = {
  params: Promise<{ id: string }>
}

export default async function AdminCategoriesEditPage({ params }: Props) {
  await connection()
  await requireAdmin()
  const { id } = await params
  const [category, adjacent] = await Promise.all([
    getCategoryById(id),
    resolveAdjacentCategories(id),
  ])
  if (!category) notFound()

  return (
    <FadeUp>
      <CategoryForm
        mode="edit"
        category={category}
        prevHref={adjacent.prevHref}
        nextHref={adjacent.nextHref}
        listPosition={adjacent.position}
        listTotal={adjacent.total}
      />
    </FadeUp>
  )
}
