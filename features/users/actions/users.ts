"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { canAdminManageUsers } from "@/features/users/permissions/users";
import {
  userCreateSchema,
  userUpdateSchema,
  userDeleteSchema,
  userChangePasswordSchema,
} from "@/features/users/schemas/users";
import {
  updateUserInDb,
  deleteUserInDb,
  getUserByEmail,
} from "@/features/users/db/users";
import type { UpdateUserInput } from "@/features/users/db/users";
import { applyDefaultPointsToNewUser } from "@/features/points/db/points";

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
    image: emptyToNull(formData.get("image")),
    archived: formData.get("archived") === "on",
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
  const imageUrl = (parsed.data.image ?? "").trim() || undefined;
  const result = await auth.api.signUpEmail({
    body: {
      email,
      password: parsed.data.password,
      name: parsed.data.name,
      role: parsed.data.role,
      image: imageUrl,
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
  await applyDefaultPointsToNewUser(email);
  // Ensure profile image and archived are saved (better-auth may not persist on signup)
  const needUpdate = imageUrl || parsed.data.archived === true;
  if (needUpdate) {
    const newUser = await getUserByEmail(email);
    if (newUser) {
      const updates: { image?: string; archived?: boolean } = {};
      if (imageUrl) updates.image = imageUrl;
      if (parsed.data.archived === true) updates.archived = true;
      await updateUserInDb(newUser.id, updates);
    }
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
    points: (() => {
      const v = formData.get("points");
      if (v === null || v === undefined || v === "") return undefined;
      const n = parseInt(String(v), 10);
      return Number.isNaN(n) ? undefined : n;
    })(),
    verified: formData.get("verified") === "on",
    archived: formData.get("archived") === "on",
    image: emptyToNull(formData.get("image")),
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
  const { userId, ...rest } = parsed.data;
  const data: UpdateUserInput = { ...rest };
  if (rest.role === "user") {
    data.verified = rest.verified === true;
  }
  if (rest.archived !== undefined) {
    data.archived = rest.archived === true;
  }
  if (rest.image !== undefined) {
    data.image = rest.image ?? null;
  }
  await updateUserInDb(userId, data);
  return { success: true, userId };
}

export async function changeUserPasswordAction(formData: FormData) {
  const parsed = userChangePasswordSchema.safeParse({
    userId: formData.get("userId"),
    newPassword: formData.get("newPassword"),
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

  try {
    const setUserPasswordFn = (auth.api as unknown as { setUserPassword?: unknown }).setUserPassword
    if (typeof setUserPasswordFn !== "function") {
      return {
        error:
          "Admin password reset is not enabled in auth config. Please ensure Better-Auth admin plugin is configured.",
      }
    }

    await auth.api.setUserPassword({
      body: {
        userId: parsed.data.userId,
        newPassword: parsed.data.newPassword,
      },
      headers: await headers(),
    });
    return { success: true, userId: parsed.data.userId };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to change password";
    return { error: msg };
  }
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
