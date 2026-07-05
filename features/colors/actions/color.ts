"use server";

import { revalidateColorCache } from "@/features/colors/db/cache/color";
import { canAdminManageColor } from "@/features/colors/permissions/color";
import {
  colorCreateSchema,
  colorUpdateSchema,
  colorDeleteSchema,
} from "@/features/colors/schemas/color";
import {
  createColorInDb,
  updateColorInDb,
  deleteColorInDb,
} from "@/features/colors/db/color";
import { emptyToNull, zodErrorMessage } from "@/lib/form-data";
import { requireActionRole } from "@/lib/action-guard";

const DUPLICATE_NAME_ERROR = "A colour with this name already exists";

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const e = error as { code?: string; cause?: { code?: string } };
  return e.code === "23505" || e.cause?.code === "23505";
}

export async function createColorAction(formData: FormData) {
  const parsed = colorCreateSchema.safeParse({
    name: emptyToNull(formData.get("name")),
    hexCode: (formData.get("hexCode") as string | null) ?? "",
  });
  if (!parsed.success) {
    return { error: zodErrorMessage(parsed.error) };
  }
  const session = await requireActionRole(canAdminManageColor);
  if (!session) {
    return { error: "Unauthorized" };
  }
  try {
    const colorId = await createColorInDb({
      name: parsed.data.name,
      hexCode: parsed.data.hexCode,
    });
    revalidateColorCache();
    return { success: true, colorId };
  } catch (error) {
    if (isUniqueViolation(error)) return { error: DUPLICATE_NAME_ERROR };
    throw error;
  }
}

export async function updateColorAction(formData: FormData) {
  const parsed = colorUpdateSchema.safeParse({
    colorId: formData.get("colorId"),
    name: emptyToNull(formData.get("name")),
    hexCode: (formData.get("hexCode") as string | null) ?? "",
  });
  if (!parsed.success) {
    return { error: zodErrorMessage(parsed.error) };
  }
  const session = await requireActionRole(canAdminManageColor);
  if (!session) {
    return { error: "Unauthorized" };
  }
  const { colorId, ...data } = parsed.data;
  try {
    await updateColorInDb(colorId, data);
    revalidateColorCache(colorId);
    return { success: true, colorId };
  } catch (error) {
    if (isUniqueViolation(error)) return { error: DUPLICATE_NAME_ERROR };
    throw error;
  }
}

export async function deleteColorAction(formData: FormData) {
  const parsed = colorDeleteSchema.safeParse({
    colorId: formData.get("colorId"),
  });
  if (!parsed.success) return { error: "Invalid input" };
  const session = await requireActionRole(canAdminManageColor);
  if (!session) {
    return { error: "Unauthorized" };
  }
  const deleted = await deleteColorInDb(parsed.data.colorId);
  if (!deleted) return { error: "Color not found" };
  revalidateColorCache(parsed.data.colorId);
  return { success: true };
}
