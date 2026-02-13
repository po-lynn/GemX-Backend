"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidateLaboratoryCache } from "@/features/laboratory/db/cache/laboratory";
import { canAdminManageLaboratory } from "@/features/laboratory/permissions/laboratory";
import {
  laboratoryCreateSchema,
  laboratoryUpdateSchema,
  laboratoryDeleteSchema,
} from "@/features/laboratory/schemas/laboratory";
import {
  createLaboratoryInDb,
  updateLaboratoryInDb,
  deleteLaboratoryInDb,
} from "@/features/laboratory/db/laboratory";

function emptyToNull<T>(v: T): T | null | undefined {
  return v === "" ? null : (v ?? undefined);
}

export async function createLaboratoryAction(formData: FormData) {
  const parsed = laboratoryCreateSchema.safeParse({
    name: formData.get("name"),
    address: emptyToNull(formData.get("address")),
    phone: emptyToNull(formData.get("phone")),
  });

  if (!parsed.success) {
    return {
      error:
        parsed.error.flatten().formErrors.join(", ") || "Invalid input",
    };
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !canAdminManageLaboratory(session.user.role)) {
    return { error: "Unauthorized" };
  }

  const laboratoryId = await createLaboratoryInDb({
    name: parsed.data.name,
    address: parsed.data.address,
    phone: parsed.data.phone,
  });

  revalidateLaboratoryCache();
  return { success: true, laboratoryId };
}

export async function updateLaboratoryAction(formData: FormData) {
  const parsed = laboratoryUpdateSchema.safeParse({
    laboratoryId: formData.get("laboratoryId"),
    name: formData.get("name") || undefined,
    address: emptyToNull(formData.get("address")),
    phone: emptyToNull(formData.get("phone")),
  });

  if (!parsed.success) {
    return {
      error:
        parsed.error.flatten().formErrors.join(", ") || "Invalid input",
    };
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !canAdminManageLaboratory(session.user.role)) {
    return { error: "Unauthorized" };
  }

  const { laboratoryId, ...data } = parsed.data;
  await updateLaboratoryInDb(laboratoryId, data);

  revalidateLaboratoryCache();
  return { success: true, laboratoryId };
}

export async function deleteLaboratoryAction(formData: FormData) {
  const parsed = laboratoryDeleteSchema.safeParse({
    laboratoryId: formData.get("laboratoryId"),
  });

  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !canAdminManageLaboratory(session.user.role)) {
    return { error: "Unauthorized" };
  }

  const deleted = await deleteLaboratoryInDb(parsed.data.laboratoryId);
  if (!deleted) return { error: "Laboratory not found" };

  revalidateLaboratoryCache();
  return { success: true };
}
