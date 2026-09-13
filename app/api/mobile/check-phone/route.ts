import { connection } from "next/server"
import { jsonError, jsonUncached } from "@/lib/api"
import { normalizeMyanmarPhone } from "@/lib/phone"
import { rateLimit } from "@/lib/rate-limit"
import { getUserEmailByPhone } from "@/features/users/db/users"

/**
 * Public — signup page can check whether a Myanmar phone is already registered.
 * POST /api/mobile/check-phone  body: { "phone": "09123456789" }
 */
export async function POST(req: Request) {
  await connection()

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  const rl = rateLimit(`check-phone:${ip}`, 30, 15 * 60 * 1000)
  if (!rl.allowed) {
    return Response.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)),
        },
      },
    )
  }

  try {
    const body = (await req.json().catch(() => null)) as { phone?: unknown } | null
    const phone = normalizeMyanmarPhone(String(body?.phone ?? ""))

    if (!phone) {
      return jsonError("Phone must start with 09 (e.g. 09123456789)", 400)
    }

    const email = await getUserEmailByPhone(phone)
    const exists = email != null

    return jsonUncached({
      exists,
      available: !exists,
      phone,
    })
  } catch (e) {
    console.error("POST /api/mobile/check-phone:", e)
    return jsonError("Failed to check phone number", 500)
  }
}
