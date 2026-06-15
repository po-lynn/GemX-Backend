"use server"

import { headers } from "next/headers"
import { normalizeMyanmarPhone } from "@/lib/phone"
import { getUserEmailByPhone } from "@/features/users/db/users"
import { rateLimit } from "@/lib/rate-limit"

/** 10 lookups per IP per minute. */
const LIMIT = 10
const WINDOW_MS = 60_000

/**
 * Given a raw phone input, normalize to E.164 and look up the associated email.
 * Returns null for invalid phone format, phone not found, or rate limit exceeded.
 * All three map to the same "Invalid credentials" UI message — no enumeration.
 */
export async function getEmailForPhoneLoginAction(rawPhone: string): Promise<string | null> {
  const hdrs = await headers()
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    hdrs.get("x-real-ip") ??
    "unknown"

  const result = rateLimit(`phone-lookup:${ip}`, LIMIT, WINDOW_MS)
  if (!result.allowed) return null

  const normalized = normalizeMyanmarPhone(rawPhone)
  if (!normalized) return null
  return getUserEmailByPhone(normalized)
}
