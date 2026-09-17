import { NextRequest, connection } from "next/server"
import { z } from "zod"
import { requireAdminOrFeature } from "@/lib/api-guard"
import { jsonError, jsonUncached } from "@/lib/api"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { createEscrowCannedResponse, listEscrowCannedResponses } from "@/features/escrow-cases/db/canned-responses"

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  bodyEn: z.string().trim().min(1).max(2000),
  bodyMy: z.string().trim().min(1).max(2000),
  sortOrder: z.number().int().optional(),
})

/** GET /api/admin/escrow-canned-responses?activeOnly=true|false (default true — the
 *  reply-box picker only wants enabled templates; the admin config page passes false). */
export async function GET(request: NextRequest) {
  await connection()
  const gate = await requireAdminOrFeature(request, FEATURE_KEYS.ESCROW_CASES)
  if ("error" in gate) return gate.error

  try {
    const activeOnly = new URL(request.url).searchParams.get("activeOnly") !== "false"
    const responses = await listEscrowCannedResponses(activeOnly)
    return jsonUncached({ success: true, responses })
  } catch (error) {
    console.error("GET /api/admin/escrow-canned-responses:", error)
    return jsonError("Failed to load canned responses", 500)
  }
}

export async function POST(request: NextRequest) {
  await connection()
  const gate = await requireAdminOrFeature(request, FEATURE_KEYS.ESCROW_CASES)
  if ("error" in gate) return gate.error

  try {
    const parsed = createSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return jsonError("Invalid input", 400)

    const created = await createEscrowCannedResponse({
      ...parsed.data,
      createdByAdminId: gate.session.user.id,
    })
    return jsonUncached({ success: true, response: created })
  } catch (error) {
    console.error("POST /api/admin/escrow-canned-responses:", error)
    return jsonError("Failed to create canned response", 500)
  }
}
