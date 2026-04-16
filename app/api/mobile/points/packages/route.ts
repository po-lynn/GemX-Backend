import { NextRequest, connection } from "next/server"
import { jsonCached, jsonError } from "@/lib/api"
import { getPaymentMethods, getPointPurchasePackagesSettings } from "@/features/points/db/points"

/**
 * GET /api/mobile/points/packages
 * Public endpoint — returns available credit point packages and the configured payment methods
 * (e.g., KBZ Pay, AYA Pay) for wire transfer payment.
 */
export async function GET(_request: NextRequest) {
  await connection()
  try {
    const [settings, paymentMethods] = await Promise.all([
      getPointPurchasePackagesSettings(),
      getPaymentMethods(),
    ])
    return jsonCached({
      pointPackages: settings.packages,
      paymentMethods,
    })
  } catch (e) {
    console.error("GET /api/mobile/points/packages:", e)
    return jsonError("Failed to load point packages", 500)
  }
}
