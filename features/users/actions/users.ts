"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { canAdminManageUsers } from "@/features/users/permissions/users";
import {
  userCreateSchema,
  userUpdateSchema,
  userDeleteSchema,
} from "@/features/users/schemas/users";
import {
  getUserById,
  updateUserInDb,
  deleteUserInDb,
} from "@/features/users/db/users";

function emptyToNull<T>(v: T): T | null | undefined {
  return v === "" ? null : (v ?? undefined);
}

export async function createUserAction(formData: FormData) {
  const parsed = userCreateSchema.safeParse({
    name: formData.get("name"),
    email: emptyToNull(formData.get("email")),
    password: formData.get("password"),
    role: formData.get("role"),
    phone: emptyToNull(formData.get("phone")),
    gender: emptyToNull(formData.get("gender")),
    dateOfBirth: emptyToNull(formData.get("dateOfBirth")),
    nrc: emptyToNull(formData.get("nrc")),
    address: emptyToNull(formData.get("address")),
    city: emptyToNull(formData.get("city")),
    state: emptyToNull(formData.get("state")),
    country: emptyToNull(formData.get("country")),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.flatten().formErrors.join(", ") || "Invalid input",
    };
  }
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !canAdminManageUsers(session.user.role)) {
    return { error: "Unauthorized" };
  }
  const email = (parsed.data.email ?? "").trim();
  if (!email) {
    return { error: "Email is required to create a user." };
  }
  const result = await auth.api.signUpEmail({
    body: {
      email,
      password: parsed.data.password,
      name: parsed.data.name,
      role: parsed.data.role,
      phone: (parsed.data.phone ?? "").trim() || undefined,
      gender: (parsed.data.gender ?? "").trim() || undefined,
      dateOfBirth: (parsed.data.dateOfBirth ?? "").trim() || undefined,
      nrc: (parsed.data.nrc ?? "").trim() || undefined,
      address: (parsed.data.address ?? "").trim() || undefined,
      city: (parsed.data.city ?? "").trim() || undefined,
      state: (parsed.data.state ?? "").trim() || undefined,
      country: (parsed.data.country ?? "").trim() || undefined,
    },
  });
  if (result && "error" in result && result.error) {
    const msg = String(result.error);
    if (
      msg.toLowerCase().includes("duplicate") ||
      msg.toLowerCase().includes("unique") ||
      msg.toLowerCase().includes("already")
    ) {
      return { error: "A user with this email already exists." };
    }
    return { error: msg };
  }
  return { success: true };
}

export async function updateUserAction(formData: FormData) {
  const parsed = userUpdateSchema.safeParse({
    userId: formData.get("userId"),
    name: emptyToNull(formData.get("name")),
    email: emptyToNull(formData.get("email")),
    role: emptyToNull(formData.get("role")),
    phone: emptyToNull(formData.get("phone")),
    gender: emptyToNull(formData.get("gender")),
    dateOfBirth: emptyToNull(formData.get("dateOfBirth")),
    username: emptyToNull(formData.get("username")),
    displayUsername: emptyToNull(formData.get("displayUsername")),
    nrc: emptyToNull(formData.get("nrc")),
    address: emptyToNull(formData.get("address")),
    city: emptyToNull(formData.get("city")),
    state: emptyToNull(formData.get("state")),
    country: emptyToNull(formData.get("country")),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.flatten().formErrors.join(", ") || "Invalid input",
    };
  }
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !canAdminManageUsers(session.user.role)) {
    return { error: "Unauthorized" };
  }
  const { userId, ...data } = parsed.data;
  await updateUserInDb(userId, data);
  return { success: true, userId };
}

export async function deleteUserAction(formData: FormData) {
  const parsed = userDeleteSchema.safeParse({
    userId: formData.get("userId"),
  });
  if (!parsed.success) return { error: "Invalid input" };
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !canAdminManageUsers(session.user.role)) {
    return { error: "Unauthorized" };
  }
  if (session.user.id === parsed.data.userId) {
    return { error: "You cannot delete your own account." };
  }
  const deleted = await deleteUserInDb(parsed.data.userId);
  if (!deleted) return { error: "User not found" };
  return { success: true };
}
