import { NextRequest, connection } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { jsonError, jsonUncached } from "@/lib/api"
import { db } from "@/drizzle/db"
import { user as userTable } from "@/drizzle/schema"
import { eq } from "drizzle-orm"
import { validateNrc } from "@/lib/nrc"

const urlField = z.string().url().optional().nullable()

// Non-Myanmar users register via Google/Facebook rather than phone+NRC, so `nrc` doubles as a
// passport/national ID for them — only enforce the Myanmar NRC format when country is Myanmar (or unset).
const profileUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    nrc: z.string().trim().max(20).optional().nullable(),
    address: z.string().max(500).optional().nullable(),
    city: z.string().max(100).optional().nullable(),
    state: z.string().max(100).optional().nullable(),
    country: z.string().max(100).optional().nullable(),
    gender: z.string().max(20).optional().nullable(),
    dateOfBirth: z.string().max(20).optional().nullable(),
    nrcFrontUrl: urlField,
    nrcBackUrl: urlField,
    selfieUrl: urlField,
    businessLicenseUrl: urlField,
  })
  .superRefine((data, ctx) => {
    const isMyanmar = !data.country || data.country.trim().toLowerCase() === "myanmar"
    if (data.nrc && isMyanmar && !validateNrc(data.nrc)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["nrc"],
        message: "Invalid NRC format — expected e.g. 12/ABC(N)123456 or the Myanmar script equivalent",
      })
    }
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
  if (data.name !== undefined) updates.name = data.name
  if (data.nrc !== undefined) updates.nrc = data.nrc
  if (data.address !== undefined) updates.address = data.address
  if (data.city !== undefined) updates.city = data.city
  if (data.state !== undefined) updates.state = data.state
  if (data.country !== undefined) updates.country = data.country
  if (data.gender !== undefined) updates.gender = data.gender
  if (data.dateOfBirth !== undefined) updates.dateOfBirth = data.dateOfBirth
  if (data.nrcFrontUrl !== undefined) updates.nrcFrontUrl = data.nrcFrontUrl
  if (data.nrcBackUrl !== undefined) updates.nrcBackUrl = data.nrcBackUrl
  if (data.selfieUrl !== undefined) updates.selfieUrl = data.selfieUrl
  if (data.businessLicenseUrl !== undefined) updates.businessLicenseUrl = data.businessLicenseUrl

  if (Object.keys(updates).length > 0) {
    updates.updatedAt = new Date()
    try {
      await db.update(userTable).set(updates).where(eq(userTable.id, session.user.id))
    } catch (err: unknown) {
      const msg = String((err as { message?: string })?.message ?? "")
      if (msg.includes("user_nrc_unique") || (msg.includes("unique") && msg.includes("nrc"))) {
        return jsonError("This NRC number is already registered to another account.", 409)
      }
      throw err
    }
  }

  return jsonUncached({ ok: true })
}
