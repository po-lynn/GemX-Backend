import { cacheTag, cacheLife, revalidateTag } from "next/cache"
import { eq } from "drizzle-orm"
import { db } from "@/drizzle/db"
import { staffRole, type staffRoleEnum } from "@/drizzle/schema/staff-role-schema"
import { user } from "@/drizzle/schema/auth-schema"
import { getIdTag, getGlobalTag } from "@/lib/dataCache"

export type StaffRoleValue = (typeof staffRoleEnum.enumValues)[number]

export type StaffRoleRow = {
  userId: string
  role: StaffRoleValue
  isSupervisor: boolean
}

function staffRoleUserTag(userId: string) {
  return getIdTag("staffRole", userId)
}

function staffRoleListTag() {
  return getGlobalTag("staffRole")
}

/** One staff member's dedicated designation (escrow_agent/moderator/support/analyst), or null. */
export async function getStaffRole(userId: string): Promise<StaffRoleRow | null> {
  "use cache"
  cacheTag(staffRoleUserTag(userId))
  cacheLife("max")
  const [row] = await db
    .select({ userId: staffRole.userId, role: staffRole.role, isSupervisor: staffRole.isSupervisor })
    .from(staffRole)
    .where(eq(staffRole.userId, userId))
    .limit(1)
  return row ?? null
}

/** Every user holding a given designation — backs the "assign agent" dropdown and the supervisor's "all agents" view. */
export async function getUsersByStaffRole(
  role: StaffRoleValue
): Promise<Array<{ userId: string; name: string; email: string; isSupervisor: boolean }>> {
  "use cache"
  cacheTag(staffRoleListTag())
  cacheLife("max")
  return db
    .select({
      userId: staffRole.userId,
      name: user.name,
      email: user.email,
      isSupervisor: staffRole.isSupervisor,
    })
    .from(staffRole)
    .innerJoin(user, eq(user.id, staffRole.userId))
    .where(eq(staffRole.role, role))
}

export async function setStaffRole(userId: string, role: StaffRoleValue, isSupervisor: boolean): Promise<void> {
  await db
    .insert(staffRole)
    .values({ userId, role, isSupervisor })
    .onConflictDoUpdate({
      target: staffRole.userId,
      set: { role, isSupervisor, updatedAt: new Date() },
    })
  revalidateTag(staffRoleUserTag(userId), "max")
  revalidateTag(staffRoleListTag(), "max")
}

export async function clearStaffRole(userId: string): Promise<void> {
  await db.delete(staffRole).where(eq(staffRole.userId, userId))
  revalidateTag(staffRoleUserTag(userId), "max")
  revalidateTag(staffRoleListTag(), "max")
}
