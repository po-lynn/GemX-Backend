import { NextRequest, connection } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { jsonError, jsonUncached } from "@/lib/api"
import { db } from "@/drizzle/db"
import { user as userTable } from "@/drizzle/schema"
import { eq } from "drizzle-orm"

const urlField = z.string().url().optional().nullable()

const profileUpdateSchema = z.object({
  nrc: z.string().max(100).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  nrcFrontUrl: urlField,
  nrcBackUrl: urlField,
  selfieUrl: urlField,
  businessLicenseUrl: urlField,
})

export async function PATCH(request: NextRequest) {
  await connection()
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user?.id) return jsonError("Unauthorized", 401)

  const body = await request.json().catch(() => null)
  const parsed = profileUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid request", 400)
  }

  const data = parsed.data
  const updates: Record<string, unknown> = {}
  if (data.nrc !== undefined) updates.nrc = data.nrc
  if (data.address !== undefined) updates.address = data.address
  if (data.city !== undefined) updates.city = data.city
  if (data.state !== undefined) updates.state = data.state
  if (data.country !== undefined) updates.country = data.country
  if (data.nrcFrontUrl !== undefined) updates.nrcFrontUrl = data.nrcFrontUrl
  if (data.nrcBackUrl !== undefined) updates.nrcBackUrl = data.nrcBackUrl
  if (data.selfieUrl !== undefined) updates.selfieUrl = data.selfieUrl
  if (data.businessLicenseUrl !== undefined) updates.businessLicenseUrl = data.businessLicenseUrl

  if (Object.keys(updates).length > 0) {
    updates.updatedAt = new Date()
    await db.update(userTable).set(updates).where(eq(userTable.id, session.user.id))
  }

  return jsonUncached({ ok: true })
}
