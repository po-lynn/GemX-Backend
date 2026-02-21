import { db } from "@/drizzle/db";
import { user } from "@/drizzle/schema/auth-schema";
import { eq, asc, ilike, or } from "drizzle-orm";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  points: number;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type UserForEdit = UserRow & {
  username: string | null;
  displayUsername: string | null;
  nrc: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
};

export async function getAllUsersFromDb(opts?: {
  search?: string;
}): Promise<UserRow[]> {
  const search = opts?.search?.trim();
  const condition = search
    ? or(
        ilike(user.name, `%${search}%`),
        ilike(user.email, `%${search}%`),
        ilike(user.phone ?? "", `%${search}%`),
        ilike(user.role, `%${search}%`)
      )
    : undefined;
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      gender: user.gender,
      dateOfBirth: user.dateOfBirth,
      points: user.points,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })
    .from(user)
    .where(condition)
    .orderBy(asc(user.name));
  return rows;
}

export async function getUserById(id: string): Promise<UserForEdit | null> {
  const [row] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      gender: user.gender,
      dateOfBirth: user.dateOfBirth,
      points: user.points,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      username: user.username,
      displayUsername: user.displayUsername,
      nrc: user.nrc,
      address: user.address,
      city: user.city,
      state: user.state,
      country: user.country,
    })
    .from(user)
    .where(eq(user.id, id))
    .limit(1);
  return row ?? null;
}

export type UpdateUserInput = {
  name?: string;
  email?: string;
  role?: string;
  phone?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  points?: number;
  username?: string | null;
  displayUsername?: string | null;
  nrc?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
};

export async function updateUserInDb(
  id: string,
  input: UpdateUserInput
): Promise<void> {
  const updates = Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== undefined)
  );
  if (Object.keys(updates).length === 0) return;
  await db.update(user).set(updates).where(eq(user.id, id));
}

export async function deleteUserInDb(id: string): Promise<boolean> {
  const deleted = await db
    .delete(user)
    .where(eq(user.id, id))
    .returning({ id: user.id });
  return deleted.length > 0;
}
