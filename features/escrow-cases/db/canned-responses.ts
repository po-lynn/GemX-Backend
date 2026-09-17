import { asc, eq } from "drizzle-orm"
import { db } from "@/drizzle/db"
import { escrowCannedResponse } from "@/drizzle/schema/escrow-canned-response-schema"

export type EscrowCannedResponseItem = {
  id: string
  title: string
  bodyEn: string
  bodyMy: string
  isActive: boolean
  sortOrder: number
  createdByAdminId: string | null
  createdAt: string
  updatedAt: string
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function mapRow(row: typeof escrowCannedResponse.$inferSelect): EscrowCannedResponseItem {
  return {
    id: row.id,
    title: row.title,
    bodyEn: row.bodyEn,
    bodyMy: row.bodyMy,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    createdByAdminId: row.createdByAdminId,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  }
}

/** `activeOnly` true for the agent's insert-into-reply picker; false for the admin
 *  config list, which also needs to show (and let someone re-enable) disabled ones. */
export async function listEscrowCannedResponses(activeOnly: boolean): Promise<EscrowCannedResponseItem[]> {
  const rows = await db
    .select()
    .from(escrowCannedResponse)
    .where(activeOnly ? eq(escrowCannedResponse.isActive, true) : undefined)
    .orderBy(asc(escrowCannedResponse.sortOrder), asc(escrowCannedResponse.title))
  return rows.map(mapRow)
}

export async function createEscrowCannedResponse(input: {
  title: string
  bodyEn: string
  bodyMy: string
  sortOrder?: number
  createdByAdminId: string
}): Promise<EscrowCannedResponseItem> {
  const [row] = await db
    .insert(escrowCannedResponse)
    .values({
      title: input.title,
      bodyEn: input.bodyEn,
      bodyMy: input.bodyMy,
      sortOrder: input.sortOrder ?? 0,
      createdByAdminId: input.createdByAdminId,
    })
    .returning()
  if (!row) throw new Error("Failed to create canned response")
  return mapRow(row)
}

export async function updateEscrowCannedResponse(
  id: string,
  input: Partial<{ title: string; bodyEn: string; bodyMy: string; isActive: boolean; sortOrder: number }>
): Promise<EscrowCannedResponseItem | null> {
  const [row] = await db
    .update(escrowCannedResponse)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(escrowCannedResponse.id, id))
    .returning()
  return row ? mapRow(row) : null
}

export async function deleteEscrowCannedResponse(id: string): Promise<boolean> {
  const deleted = await db.delete(escrowCannedResponse).where(eq(escrowCannedResponse.id, id)).returning({
    id: escrowCannedResponse.id,
  })
  return deleted.length > 0
}
