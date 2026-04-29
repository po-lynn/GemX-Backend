import { desc, eq } from "drizzle-orm"
import { db } from "@/drizzle/db"
import { escrowServiceSetting } from "@/drizzle/schema/escrow-service-setting-schema"

export type EscrowServiceSettings = {
  userId: string | null
  serviceFee: string
  serviceOverview: string
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

