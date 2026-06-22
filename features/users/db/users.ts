import { db } from "@/drizzle/db";
import { user } from "@/drizzle/schema/auth-schema";
import { and, eq, ne, asc, desc, ilike, or, sql } from "drizzle-orm";

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
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
  image?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
};

export type UserForEdit = UserRow & {
  image: string | null;
  username: string | null;
  displayUsername: string | null;
  nrc: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  nrcFrontUrl: string | null;
  nrcBackUrl: string | null;
  selfieUrl: string | null;
  businessLicenseUrl: string | null;
};

export type UserPickerOption = {
  id: string
  name: string | null
  email: string
  phone: string | null
  points: number
  role: string
}

export async function getRecentUsersForPicker(limit = 5): Promise<UserPickerOption[]> {
  return db
    .select({ id: user.id, name: user.name, email: user.email, phone: user.phone, points: user.points, role: user.role })
    .from(user)
    .orderBy(desc(user.createdAt))
    .limit(limit)
}

export async function searchUsersForPicker(query: string, limit = 8): Promise<UserPickerOption[]> {
  const q = query.trim()
  const condition = q
    ? or(
        ilike(user.name, `%${q}%`),
        ilike(user.email, `%${q}%`),
        ilike(user.phone ?? "", `%${q}%`)
      )
    : undefined
  return db
    .select({ id: user.id, name: user.name, email: user.email, phone: user.phone, points: user.points, role: user.role })
    .from(user)
    .where(condition)
    .orderBy(asc(user.name))
    .limit(limit)
}

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
      image: user.image,
      gender: user.gender,
      dateOfBirth: user.dateOfBirth,
      points: user.points,
      emailVerified: user.emailVerified,
      verified: user.verified,
      archived: user.archived,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })
    .from(user)
    .where(condition)
    .orderBy(asc(user.name));
  return rows;
}

export type UserStats = {
  total: number;
  active: number;
  verified: number;
  totalPoints: number;
  newThisWeek: number;
};

export async function getUserStatsFromDb(): Promise<UserStats> {
  const [row] = await db
    .select({
      total:       sql<number>`count(*)::int`,
      active:      sql<number>`sum(case when ${user.archived} = false then 1 else 0 end)::int`,
      verified:    sql<number>`sum(case when ${user.verified} = true and ${user.emailVerified} = true then 1 else 0 end)::int`,
      totalPoints: sql<number>`coalesce(sum(${user.points}), 0)::int`,
      newThisWeek: sql<number>`count(*) filter (where ${user.createdAt} > now() - interval '7 days')::int`,
    })
    .from(user);
  return {
    total:       row?.total       ?? 0,
    active:      row?.active      ?? 0,
    verified:    row?.verified    ?? 0,
    totalPoints: row?.totalPoints ?? 0,
    newThisWeek: row?.newThisWeek ?? 0,
  };
}

export type ViewCounts = {
  all: number; pending: number; admins: number; internals: number; portals: number; archived: number;
};

export async function getViewCountsFromDb(): Promise<ViewCounts> {
  const [row] = await db
    .select({
      all:         sql<number>`sum(case when ${user.archived} = false then 1 else 0 end)::int`,
      pending:     sql<number>`sum(case when ${user.archived} = false and ${user.emailVerified} = false then 1 else 0 end)::int`,
      admins:      sql<number>`sum(case when ${user.archived} = false and ${user.role} = 'admin' then 1 else 0 end)::int`,
      internals:   sql<number>`sum(case when ${user.archived} = false and ${user.role} = 'internal' then 1 else 0 end)::int`,
      portals:     sql<number>`sum(case when ${user.archived} = false and ${user.role} = 'portal' then 1 else 0 end)::int`,
      archived:    sql<number>`sum(case when ${user.archived} = true  then 1 else 0 end)::int`,
    })
    .from(user);
  return {
    all:         row?.all         ?? 0,
    pending:     row?.pending     ?? 0,
    admins:      row?.admins      ?? 0,
    internals:   row?.internals   ?? 0,
    portals:     row?.portals     ?? 0,
    archived:    row?.archived    ?? 0,
  };
}

/** List users with pagination. Optional search and view filter. */
export async function getUsersPaginatedFromDb(options: {
  page: number;
  limit: number;
  search?: string;
  view?: string;
  excludeAdminRole?: boolean;
}): Promise<{ users: UserRow[]; total: number }> {
  const { page, limit, search, view, excludeAdminRole } = options;
  const searchTrim = search?.trim();
  const searchCondition = searchTrim
    ? or(
        ilike(user.name, `%${searchTrim}%`),
        ilike(user.email, `%${searchTrim}%`),
        ilike(user.phone ?? "", `%${searchTrim}%`),
        ilike(user.role, `%${searchTrim}%`),
        ilike(user.country ?? "", `%${searchTrim}%`)
      )
    : undefined;
  const viewCondition = (() => {
    switch (view) {
      case "pending":     return and(eq(user.archived, false), eq(user.emailVerified, false));
      case "admins":      return and(eq(user.archived, false), eq(user.role, "admin"));
      case "internals":   return and(eq(user.archived, false), eq(user.role, "internal"));
      case "portals":     return and(eq(user.archived, false), eq(user.role, "portal"));
      case "archived":    return eq(user.archived, true);
      default:         return eq(user.archived, false);
    }
  })();
  const excludeAdminCondition = excludeAdminRole ? ne(user.role, "admin") : undefined;
  const conditions = [viewCondition, excludeAdminCondition, searchCondition].filter(Boolean);
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
    archived: user.archived,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    image: user.image,
    city: user.city,
    state: user.state,
    country: user.country,
  };
  const users = await db
    .select(selectFields)
    .from(user)
    .where(condition)
    .orderBy(asc(user.name))
    .limit(limit)
    .offset((page - 1) * limit)
  const countResult = condition
    ? await db.select({ count: sql<number>`count(*)::int` }).from(user).where(condition)
    : await db.select({ count: sql<number>`count(*)::int` }).from(user)
  const total = countResult[0]?.count ?? 0;
  return { users, total };
}

export async function getUserByEmail(email: string): Promise<{ id: string } | null> {
  const [row] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email.trim()))
    .limit(1);
  return row ?? null;
}

export async function getUserEmailByPhone(phone: string): Promise<string | null> {
  const [row] = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.phone, phone))
    .limit(1);
  return row?.email ?? null;
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
      archived: user.archived,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      image: user.image,
      username: user.username,
      displayUsername: user.displayUsername,
      nrc: user.nrc,
      address: user.address,
      city: user.city,
      state: user.state,
      country: user.country,
      nrcFrontUrl: user.nrcFrontUrl,
      nrcBackUrl: user.nrcBackUrl,
      selfieUrl: user.selfieUrl,
      businessLicenseUrl: user.businessLicenseUrl,
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
  archived?: boolean;
  image?: string | null;
  username?: string | null;
  displayUsername?: string | null;
  nrc?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  nrcFrontUrl?: string | null;
  nrcBackUrl?: string | null;
  selfieUrl?: string | null;
  businessLicenseUrl?: string | null;
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
