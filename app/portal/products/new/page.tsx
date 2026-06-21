import { getAllCategories } from "@/features/categories/db/categories"
import { getAllLaboratories } from "@/features/laboratory/db/laboratory"
import PortalProductForm from "@/components/portal/PortalProductForm"

export default async function NewPortalProductPage() {
  const [categories, laboratories] = await Promise.all([
    getAllCategories(),
    getAllLaboratories(),
  ])

  return (
    <PortalProductForm
      mode="create"
      categories={categories}
      laboratories={laboratories}
      backHref="/portal/products"
    />
  )
}
