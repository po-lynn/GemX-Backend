import type { z } from "zod"

/** FormData value: "" → null (clear the column), null/undefined → undefined (skip), else keep. */
export function emptyToNull<T>(v: T): T | null | undefined {
  return v === "" ? null : (v ?? undefined)
}

/** FormData value: "" → undefined (skip), else keep. */
export function emptyToUndefined<T>(v: T): T | undefined {
  return (v === "" ? undefined : v) as T | undefined
}

/** Human-readable message from a failed Zod parse: form errors first, then field errors. */
export function zodErrorMessage(error: z.ZodError): string {
  const flat = error.flatten()
  return (
    flat.formErrors.join(", ") ||
    Object.entries(flat.fieldErrors)
      .map(([k, v]) => `${k}: ${(v as string[])?.[0] ?? "invalid"}`)
      .join(", ") ||
    "Invalid input"
  )
}
