"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidateOriginCache } from "@/features/origin/db/cache/origin";
import { canAdminManageOrigin } from "@/features/origin/permissions/origin";
import {
  originCreateSchema,
  originUpdateSchema,
  originDeleteSchema,
} from "@/features/origin/schemas/origin";
import {
  createOriginInDb,
  updateOriginInDb,
  deleteOriginInDb,
} from "@/features/origin/db/origin";

function emptyToNull<T>(v: T): T | null | undefined {
  return v === "" ? null : (v ?? undefined);
}

export async function createOriginAction(formData: FormData) {
  const parsed = originCreateSchema.safeParse({
    name: emptyToNull(formData.get("name")),
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten().formErrors.join(", ") || "Invalid input" };
  }
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !canAdminManageOrigin(session.user.role)) {
    return { error: "Unauthorized" };
  }
  const originId = await createOriginInDb({ name: parsed.data.name });
  revalidateOriginCache();
  return { success: true, originId };
}

export async function updateOriginAction(formData: FormData) {
  const parsed = originUpdateSchema.safeParse({
    originId: formData.get("originId"),
    name: emptyToNull(formData.get("name")),
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten().formErrors.join(", ") || "Invalid input" };
  }
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !canAdminManageOrigin(session.user.role)) {
    return { error: "Unauthorized" };
  }
  const { originId, ...data } = parsed.data;
  await updateOriginInDb(originId, data);
  revalidateOriginCache();
  return { success: true, originId };
}

export async function deleteOriginAction(formData: FormData) {
  const parsed = originDeleteSchema.safeParse({
    originId: formData.get("originId"),
  });
  if (!parsed.success) return { error: "Invalid input" };
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !canAdminManageOrigin(session.user.role)) {
    return { error: "Unauthorized" };
  }
  const deleted = await deleteOriginInDb(parsed.data.originId);
  if (!deleted) return { error: "Origin not found" };
  revalidateOriginCache();
  return { success: true };
}
