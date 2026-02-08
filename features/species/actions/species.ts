"use server"

import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { revalidateSpeciesCache } from "@/features/species/db/cache/species"
import { revalidateCategoriesCache } from "@/features/categories/db/cache/categories"
import { canAdminManageSpecies } from "@/features/species/permissions/species"
import {
  speciesCreateSchema,
  speciesUpdateSchema,
  speciesDeleteSchema,
} from "@/features/species/schemas/species"
import {
  createSpeciesInDb,
  updateSpeciesInDb,
  deleteSpeciesInDb,
} from "@/features/species/db/species"

function emptyToNull<T>(v: T): T | null | undefined {
  return v === "" ? null : (v ?? undefined)
}

export async function createSpeciesAction(formData: FormData) {
  const parsed = speciesCreateSchema.safeParse({
    name: formData.get("name"),
    slug: emptyToNull(formData.get("slug")),
  })

  if (!parsed.success) {
    return {
      error: parsed.error.flatten().formErrors.join(", ") || "Invalid input",
    }
  }

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || !canAdminManageSpecies(session.user.role)) {
    return { error: "Unauthorized" }
  }

  const speciesId = await createSpeciesInDb({
    name: parsed.data.name,
    slug: parsed.data.slug,
  })

  revalidateSpeciesCache()
  revalidateCategoriesCache()
  return { success: true, speciesId }
}

export async function updateSpeciesAction(formData: FormData) {
  const parsed = speciesUpdateSchema.safeParse({
    speciesId: formData.get("speciesId"),
    name: formData.get("name") || undefined,
    slug: emptyToNull(formData.get("slug")),
  })

  if (!parsed.success) {
    return {
      error: parsed.error.flatten().formErrors.join(", ") || "Invalid input",
    }
  }

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || !canAdminManageSpecies(session.user.role)) {
    return { error: "Unauthorized" }
  }

  const { speciesId, ...data } = parsed.data
  await updateSpeciesInDb(speciesId, data)

  revalidateSpeciesCache()
  revalidateCategoriesCache()
  return { success: true, speciesId }
}

export async function deleteSpeciesAction(formData: FormData) {
  const parsed = speciesDeleteSchema.safeParse({
    speciesId: formData.get("speciesId"),
  })

  if (!parsed.success) {
    return { error: "Invalid input" }
  }

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || !canAdminManageSpecies(session.user.role)) {
    return { error: "Unauthorized" }
  }

  const deleted = await deleteSpeciesInDb(parsed.data.speciesId)
  if (!deleted) return { error: "Species not found" }

  revalidateSpeciesCache()
  revalidateCategoriesCache()
  return { success: true }
}
