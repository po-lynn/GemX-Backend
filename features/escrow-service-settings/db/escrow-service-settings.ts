import { desc, eq, isNotNull } from "drizzle-orm"
import { db } from "@/drizzle/db"
import { user } from "@/drizzle/schema/auth-schema"
import { escrowServiceSetting } from "@/drizzle/schema/escrow-service-setting-schema"

export type EscrowServiceSettings = {
  userId: string | null
  serviceFee: string
  serviceOverview: string
}

/** Public profile fields for the escrow-service chat account (`escrow_service_setting.user_id`). */
export type EscrowServiceChatUserProfile = {
  id: string
  name: string
  image: string | null
  role: string
}

/**
 * Latest `escrow_service_setting` row with a non-null `user_id` joined to `user`.
 * Mobile uses `user.id` as `recipientId` for **POST `/api/chat/messages`**.
 */
export async function getEscrowServiceChatUser(): Promise<{
  configured: boolean
  user: EscrowServiceChatUserProfile | null
}> {
  const [row] = await db
    .select({
      id: user.id,
      name: user.name,
      image: user.image,
      role: user.role,
    })
    .from(escrowServiceSetting)
    .innerJoin(user, eq(user.id, escrowServiceSetting.userId))
    .where(isNotNull(escrowServiceSetting.userId))
    .orderBy(desc(escrowServiceSetting.updatedAt), desc(escrowServiceSetting.createdAt))
    .limit(1)

  if (!row) return { configured: false, user: null }

  return {
    configured: true,
    user: {
      id: row.id,
      name: row.name,
      image: row.image ?? null,
      role: row.role,
    },
  }
}

export async function getEscrowServiceSettings(): Promise<EscrowServiceSettings | null> {
  const [row] = await db
    .select({
      id: escrowServiceSetting.id,
      userId: escrowServiceSetting.userId,
      serviceFee: escrowServiceSetting.serviceFee,
      serviceOverview: escrowServiceSetting.serviceOverview,
    })
    .from(escrowServiceSetting)
    .orderBy(desc(escrowServiceSetting.updatedAt), desc(escrowServiceSetting.createdAt))
    .limit(1)

  if (!row) return null

  return {
    userId: row.userId ?? null,
    serviceFee: row.serviceFee,
    serviceOverview: row.serviceOverview ?? "",
  }
}

export async function saveEscrowServiceSettings(input: EscrowServiceSettings): Promise<void> {
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: escrowServiceSetting.id })
      .from(escrowServiceSetting)
      .orderBy(desc(escrowServiceSetting.updatedAt), desc(escrowServiceSetting.createdAt))
      .limit(1)

    if (existing) {
      await tx
        .update(escrowServiceSetting)
        .set({
          userId: input.userId,
          serviceFee: input.serviceFee,
          serviceOverview: input.serviceOverview,
          updatedAt: new Date(),
        })
        .where(eq(escrowServiceSetting.id, existing.id))
      return
    }

    await tx.insert(escrowServiceSetting).values({
      userId: input.userId,
      serviceFee: input.serviceFee,
      serviceOverview: input.serviceOverview,
    })
  })
}

