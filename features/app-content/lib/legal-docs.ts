/** Shared Legal & Guides document ids — safe for server and client imports. */

export const LEGAL_DOC_OPTIONS = [
  { id: "terms", label: "Terms & Conditions" },
  { id: "buying", label: "Buying Guide" },
  { id: "selling", label: "Selling Guide" },
  { id: "privacy", label: "Privacy Policy" },
] as const

export type LegalDocId = (typeof LEGAL_DOC_OPTIONS)[number]["id"]

export function isLegalDocId(v: string): v is LegalDocId {
  return (LEGAL_DOC_OPTIONS as readonly { id: string }[]).some((o) => o.id === v)
}
