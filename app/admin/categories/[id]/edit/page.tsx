import { connection } from "next/server"
import { notFound } from "next/navigation"
import { requireAdmin } from "@/lib/admin-guard"
import { CategoryForm } from "@/features/categories/components/CategoryForm"
import { getCategoryById } from "@/features/categories/db/categories"
import { FadeUp } from "@/components/admin/motion"

type Props = {
  params: Promise<{ id: string }>
}

export default async function AdminCategoriesEditPage({ params }: Props) {
  await connection()
  await requireAdmin()
  const { id } = await params
  const category = await getCategoryById(id)
  if (!category) notFound()

  return <FadeUp><CategoryForm mode="edit" category={category} /></FadeUp>
}
