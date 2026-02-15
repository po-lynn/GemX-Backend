import type { z } from "zod"

/** Default: 60s CDN, 300s stale-while-revalidate. */
const DEFAULT_MAX_AGE = 60
const DEFAULT_SWR = 300

/** Cache-Control for public GET (edge/CDN). Revalidate via updateTag on mutations. */
export const CACHE_CONTROL_PUBLIC =
  `public, s-maxage=${DEFAULT_MAX_AGE}, stale-while-revalidate=${DEFAULT_SWR}` as const

/** Cache-Control for mutations and errors (never cache). */
export const CACHE_CONTROL_NO_STORE = "no-store" as const

/** Build Cache-Control header for public GET. */
export function cacheHeaders(
  maxAge: number = DEFAULT_MAX_AGE,
  staleWhileRevalidate: number = DEFAULT_SWR
): Record<string, string> {
  return {
    "Cache-Control": `public, s-maxage=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
  }
}

const headersPublic = { "Cache-Control": CACHE_CONTROL_PUBLIC } as const
const headersNoStore = { "Cache-Control": CACHE_CONTROL_NO_STORE } as const

/** JSON response with public cache headers (for GET list/detail). */
export function jsonCached<T>(data: T, init?: ResponseInit): Response {
  return Response.json(data, {
    ...init,
    headers: { ...init?.headers, ...headersPublic },
  })
}

/** JSON response with no-store (mutations). */
export function jsonUncached<T>(data: T, init?: ResponseInit): Response {
  return Response.json(data, {
    ...init,
    headers: { ...init?.headers, ...headersNoStore },
  })
}

/** JSON error response (no-store so errors are not cached). */
export function jsonError(message: string, status: number): Response {
  return Response.json(
    { error: message },
    { status, headers: { ...headersNoStore } }
  )
}

/** Parse URL searchParams with Zod schema; return parsed data or defaults on invalid. */
export function parseQuery<T extends z.ZodType>(
  searchParams: URLSearchParams,
  schema: T,
): z.infer<T> {
  const parsed = schema.safeParse(Object.fromEntries(searchParams.entries()))
  return (parsed.success ? parsed.data : schema.parse({})) as z.infer<T>
}
