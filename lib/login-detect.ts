/** Returns true if the input looks like a phone number rather than an email. */
export function looksLikePhone(input: string): boolean {
  const s = input.trim()
  return /^[0-9+\-\s()]{8,20}$/.test(s) && !s.includes("@") && !s.includes(".")
}
