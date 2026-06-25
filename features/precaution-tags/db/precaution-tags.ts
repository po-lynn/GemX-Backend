import { db } from "@/drizzle/db"
import { precautionTag } from "@/drizzle/schema/precaution-tag-schema"
import { asc, eq } from "drizzle-orm"

export type PrecautionTagSeverity = "critical" | "warning" | "info"
export type PrecautionTagAppliesTo = "certified" | "non_certified" | "both"

export type PrecautionTagRow = {
  id: string
  name: string
  severity: PrecautionTagSeverity
  appliesTo: PrecautionTagAppliesTo
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export type PrecautionTagForEdit = PrecautionTagRow

/** Active tags only; for buyer-facing surfaces. */
export type PrecautionTagPublic = {
  id: string
  name: string
  severity: PrecautionTagSeverity
  appliesTo: PrecautionTagAppliesTo
}

export async function getPublicPrecautionTags(): Promise<PrecautionTagPublic[]> {
  return db
    .select({
      id: precautionTag.id,
      name: precautionTag.name,
      severity: precautionTag.severity,
      appliesTo: precautionTag.appliesTo,
    })
    .from(precautionTag)
    .where(eq(precautionTag.isActive, true))
    .orderBy(asc(precautionTag.severity), asc(precautionTag.name))
}

export async function getAllPrecautionTags(): Promise<PrecautionTagRow[]> {
  return db
    .select({
      id: precautionTag.id,
      name: precautionTag.name,
      severity: precautionTag.severity,
      appliesTo: precautionTag.appliesTo,
      isActive: precautionTag.isActive,
      createdAt: precautionTag.createdAt,
      updatedAt: precautionTag.updatedAt,
    })
    .from(precautionTag)
    .orderBy(asc(precautionTag.severity), asc(precautionTag.name))
}

export async function getPrecautionTagById(id: string): Promise<PrecautionTagForEdit | null> {
  const row = await db
    .select({
      id: precautionTag.id,
      name: precautionTag.name,
      severity: precautionTag.severity,
      appliesTo: precautionTag.appliesTo,
      isActive: precautionTag.isActive,
      createdAt: precautionTag.createdAt,
      updatedAt: precautionTag.updatedAt,
    })
    .from(precautionTag)
    .where(eq(precautionTag.id, id))
    .limit(1)
  return row[0] ?? null
}

export async function createPrecautionTagInDb(input: {
  name: string
  severity: PrecautionTagSeverity
  appliesTo: PrecautionTagAppliesTo
  isActive: boolean
}): Promise<string> {
  const [inserted] = await db
    .insert(precautionTag)
    .values({
      name: input.name,
      severity: input.severity,
      appliesTo: input.appliesTo,
      isActive: input.isActive,
    })
    .returning({ id: precautionTag.id })
  return inserted!.id
}

export async function updatePrecautionTagInDb(
  id: string,
  input: {
    name?: string
    severity?: PrecautionTagSeverity
    appliesTo?: PrecautionTagAppliesTo
    isActive?: boolean
  }
): Promise<boolean> {
  const updates = Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== undefined)
  ) as Partial<{
    name: string
    severity: PrecautionTagSeverity
    appliesTo: PrecautionTagAppliesTo
    isActive: boolean
  }>
  if (Object.keys(updates).length === 0) return true
  await db.update(precautionTag).set(updates).where(eq(precautionTag.id, id))
  return true
}

export async function deletePrecautionTagInDb(id: string): Promise<boolean> {
  const deleted = await db
    .delete(precautionTag)
    .where(eq(precautionTag.id, id))
    .returning({ id: precautionTag.id })
  return deleted.length > 0
}
