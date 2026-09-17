import { NextRequest, connection } from "next/server"
import { z } from "zod"
import { requireAdminOrFeature } from "@/lib/api-guard"
import { jsonError, jsonUncached } from "@/lib/api"
import { FEATURE_KEYS } from "@/features/rbac/feature-keys"
import { deleteEscrowCannedResponse, updateEscrowCannedResponse } from "@/features/escrow-cases/db/canned-responses"

const updateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  bodyEn: z.string().trim().min(1).max(2000).optional(),
  bodyMy: z.string().trim().min(1).max(2000).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
})

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  await connection()
  const gate = await requireAdminOrFeature(request, FEATURE_KEYS.ESCROW_CASES)
  if ("error" in gate) return gate.error

  try {
    const { id } = await context.params
    const parsed = updateSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return jsonError("Invalid input", 400)
    if (Object.keys(parsed.data).length === 0) return jsonError("No fields to update", 400)

    const updated = await updateEscrowCannedResponse(id, parsed.data)
    if (!updated) return jsonError("Not found", 404)
    return jsonUncached({ success: true, response: updated })
  } catch (error) {
    console.error("PATCH /api/admin/escrow-canned-responses/[id]:", error)
    return jsonError("Failed to update canned response", 500)
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  await connection()
  const gate = await requireAdminOrFeature(request, FEATURE_KEYS.ESCROW_CASES)
  if ("error" in gate) return gate.error

  try {
    const { id } = await context.params
    const deleted = await deleteEscrowCannedResponse(id)
    if (!deleted) return jsonError("Not found", 404)
    return jsonUncached({ success: true })
  } catch (error) {
    console.error("DELETE /api/admin/escrow-canned-responses/[id]:", error)
    return jsonError("Failed to delete canned response", 500)
  }
}
