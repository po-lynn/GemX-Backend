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

  try {
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
  } catch (err: unknown) {
    const msg = String(err)
    if (msg.includes("user_nrc_unique") || (msg.includes("unique") && msg.includes("nrc"))) {
      return { ok: false, error: "This NRC number is already registered to another account." }
    }
    if (msg.includes("user_phone_unique") || (msg.includes("unique") && msg.includes("phone"))) {
      return { ok: false, error: "This phone number is already associated with another account." }
    }
    throw err
  }

  revalidatePath("/portal")
  return { ok: true }
}
