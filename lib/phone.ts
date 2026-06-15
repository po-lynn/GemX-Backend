/** Normalizes a Myanmar mobile number to E.164 format (+959xxxxxxxx). Returns null if invalid.
 *  Accepts both domestic format (09...) and E.164 input (+959...). */
export function normalizeMyanmarPhone(input: string): string | null {
  const p = String(input || "").trim().replace(/[\s\-()]/g, "")
  if (p.startsWith("+959")) {
    if (!/^\+959\d{7,15}$/.test(p)) return null
    return p
  }
  if (p.startsWith("09")) {
    if (!/^09\d{7,15}$/.test(p)) return null
    return "+95" + p.slice(1)
  }
  return null
}

/** Derives the internal email address used by better-auth for phone-based accounts. */
export function internalEmailFromPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  return `user_${digits}@phone.local`
}
