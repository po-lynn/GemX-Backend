"use server"

import { requireActionRole } from "@/lib/action-guard"
import { canAdminManageProducts } from "@/features/products/permissions/products"
import { saveCompanySettings } from "@/features/company-settings/db/company-settings"
import { companySettingsSchema } from "@/features/company-settings/schemas/company-settings"

export async function saveCompanySettingsAction(formData: FormData) {
  const session = await requireActionRole(canAdminManageProducts)
  if (!session) return { error: "Unauthorized" }

  const parsed = companySettingsSchema.safeParse({
    companyUserId: formData.get("companyUserId"),
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    address: formData.get("address"),
    logoUrl: formData.get("logoUrl") || null,
  })

  if (!parsed.success) {
    const msg =
      parsed.error.flatten().formErrors[0] ??
      Object.values(parsed.error.flatten().fieldErrors).flat()[0] ??
      "Invalid input"
    return { error: msg }
  }

  try {
    await saveCompanySettings({
      companyUserId: parsed.data.companyUserId,
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      address: parsed.data.address,
      logoUrl: parsed.data.logoUrl ?? null,
    })
    return { success: true }
  } catch {
    return { error: "Failed to save company settings" }
  }
}
