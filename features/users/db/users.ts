import { db } from "@/drizzle/db";
import { user } from "@/drizzle/schema/auth-schema";
import { and, eq, asc, ilike, or, sql } from "drizzle-orm";

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
  verified: boolean;
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
      verified: user.verified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })
    .from(user)
    .where(condition)
    .orderBy(asc(user.name));
  return rows;
}

/** List users with pagination. Optional search and filters (country, state, city). */
export async function getUsersPaginatedFromDb(options: {
  page: number;
  limit: number;
  search?: string;
  country?: string;
  state?: string;
  city?: string;
}): Promise<{ users: UserRow[]; total: number }> {
  const { page, limit, search, country, state, city } = options;
  const searchTrim = search?.trim();
  const searchCondition = searchTrim
    ? or(
        ilike(user.name, `%${searchTrim}%`),
        ilike(user.email, `%${searchTrim}%`),
        ilike(user.phone ?? "", `%${searchTrim}%`),
        ilike(user.role, `%${searchTrim}%`)
      )
    : undefined;
  const countryCondition = country?.trim() ? eq(user.country, country.trim()) : undefined;
  const stateCondition = state?.trim() ? eq(user.state, state.trim()) : undefined;
  const cityCondition = city?.trim() ? eq(user.city, city.trim()) : undefined;
  const conditions = [
    searchCondition,
    countryCondition,
    stateCondition,
    cityCondition,
  ].filter(Boolean);
  const condition = conditions.length > 0 ? and(...conditions) : undefined;
  const selectFields = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    gender: user.gender,
    dateOfBirth: user.dateOfBirth,
    points: user.points,
    emailVerified: user.emailVerified,
    verified: user.verified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
  const [users, countResult] = await Promise.all([
    db
      .select(selectFields)
      .from(user)
      .where(condition)
      .orderBy(asc(user.name))
      .limit(limit)
      .offset((page - 1) * limit),
    condition
      ? db
          .select({ count: sql<number>`count(*)::int` })
          .from(user)
          .where(condition)
      : db.select({ count: sql<number>`count(*)::int` }).from(user),
  ]);
  const total = countResult[0]?.count ?? 0;
  return { users, total };
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
      verified: user.verified,
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
  verified?: boolean;
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
