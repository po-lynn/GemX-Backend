"use server"

import { revalidatePath } from "next/cache"
import { requireActionRole } from "@/lib/action-guard"
import { portalProfileUpdateSchema } from "@/features/users/schemas/portal-profile"
import { updateUserInDb } from "@/features/users/db/users"
import { zodErrorMessage } from "@/lib/form-data"

export async function updatePortalProfileAction(
  input: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireActionRole((r) => r === "portal")
  if (!session) return { ok: false, error: "Unauthorized" }

  const parsed = portalProfileUpdateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodErrorMessage(parsed.error) }

  const { name, phone, gender, dateOfBirth, nrc, address, city, state, country, image } = parsed.data

  await updateUserInDb(session.user.id, {
    name,
    phone:       phone ?? null,
    gender:      gender ?? null,
    dateOfBirth: dateOfBirth ?? null,
    nrc:         nrc ?? null,
    address:     address ?? null,
    city:        city ?? null,
    state:       state ?? null,
    country:     country ?? null,
    image:       image ?? null,
  })

  revalidatePath("/portal")
  return { ok: true }
}
