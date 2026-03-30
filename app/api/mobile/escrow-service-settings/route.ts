import { NextRequest, connection } from "next/server"
import { jsonCached, jsonError } from "@/lib/api"
import { getEscrowServiceSettings } from "@/features/points/db/points"

/**
 * Public read-only mobile endpoint for escrow service packages.
 * No auth required — mobile needs this to show escrow fee options based on points.
 */
export async function GET(_request: NextRequest) {
  await connection()
  try {
    const settings = await getEscrowServiceSettings()
    return jsonCached({
      escrowServicePackages: settings.packages.map((p) => ({
        name: p.name,
        pointsRequired: p.pointsRequired,
        serviceFeePercent: p.serviceFeePercent,
        transactionLimitUsd: p.transactionLimitUsd,
      })),
    })
  } catch (e) {
    console.error("GET /api/mobile/escrow-service-settings:", e)
    return jsonError("Failed to load escrow service settings", 500)
  }
}

