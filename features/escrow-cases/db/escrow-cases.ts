import { eq } from "drizzle-orm"
import { db } from "@/drizzle/db"
import { escrowCase, type escrowCaseStateEnum } from "@/drizzle/schema/escrow-case-schema"

export type EscrowCaseState = (typeof escrowCaseStateEnum.enumValues)[number]

export type EscrowCaseRow = {
  id: string
  buyerId: string
  sellerId: string
  listingId: string
  assignedAgentId: string | null
  state: EscrowCaseState
}

export async function getEscrowCaseById(caseId: string): Promise<EscrowCaseRow | null> {
  const [row] = await db
    .select({
      id: escrowCase.id,
      buyerId: escrowCase.buyerId,
      sellerId: escrowCase.sellerId,
      listingId: escrowCase.listingId,
      assignedAgentId: escrowCase.assignedAgentId,
      state: escrowCase.state,
    })
    .from(escrowCase)
    .where(eq(escrowCase.id, caseId))
    .limit(1)
  return row ?? null
}
