import { getAllCategories } from "@/features/categories/db/categories"
import { getAllLaboratories } from "@/features/laboratory/db/laboratory"
import { getAllOrigins } from "@/features/origin/db/origin"
import PortalProductForm from "@/components/portal/PortalProductForm"

export default async function NewPortalProductPage() {
  const [categories, laboratories, origins] = await Promise.all([
    getAllCategories(),
    getAllLaboratories(),
    getAllOrigins(),
  ])

  return (
    <PortalProductForm
      mode="create"
      categories={categories}
      laboratories={laboratories}
      origins={origins}
      backHref="/portal/products"
    />
  )
}
