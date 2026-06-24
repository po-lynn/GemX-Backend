import { getAdminProductsFromDb } from "@/features/products/db/products"

const PAGE_SIZE = 25

const VALID_VIEWS = ["all", "pending", "featured", "collector", "sold", "drafts"] as const
type View = (typeof VALID_VIEWS)[number]

function buildViewFilter(view: View) {
  switch (view) {
    case "pending":   return { moderationStatus: "pending" as const, excludeStatuses: ["archive", "draft"] as const }
    case "featured":  return { isFeatured: true as const, excludeStatuses: ["archive", "draft"] as const }
    case "collector": return { isCollectorPiece: true as const, excludeStatuses: ["archive", "draft"] as const }
    case "sold":      return { status: "sold" as const }
    case "drafts":    return { status: "draft" as const }
    default:          return { excludeStatuses: ["archive", "draft"] as const }
  }
}

function parsePrice(raw?: string): number | undefined {
  if (!raw) return undefined
  const n = Number(raw)
  return isFinite(n) && n >= 0 ? n : undefined
}

export type ListContext = {
  view?: string
  search?: string
  page?: string
  priceMinUSD?: string
  priceMaxUSD?: string
  priceMinMMK?: string
  priceMaxMMK?: string
}

export type AdjacentResult = {
  prevHref: string | null
  nextHref: string | null
  position: number | null
  total: number | null
}

function buildAdjacentHref(id: string, ctx: ListContext, page: number): string {
  const p = new URLSearchParams()
  const view = ctx.view ?? "all"
  if (view !== "all") p.set("view", view)
  if (ctx.search?.trim()) p.set("search", ctx.search.trim())
  p.set("page", String(page))
  if (ctx.priceMinUSD) p.set("priceMinUSD", ctx.priceMinUSD)
  if (ctx.priceMaxUSD) p.set("priceMaxUSD", ctx.priceMaxUSD)
  if (ctx.priceMinMMK) p.set("priceMinMMK", ctx.priceMinMMK)
  if (ctx.priceMaxMMK) p.set("priceMaxMMK", ctx.priceMaxMMK)
  return `/admin/products/${id}/edit?${p.toString()}`
}

export async function resolveAdjacentProducts(
  id: string,
  ctx: ListContext,
): Promise<AdjacentResult> {
  const hasContext =
    ctx.view !== undefined ||
    ctx.search !== undefined ||
    ctx.page !== undefined ||
    ctx.priceMinUSD !== undefined ||
    ctx.priceMaxUSD !== undefined ||
    ctx.priceMinMMK !== undefined ||
    ctx.priceMaxMMK !== undefined

  if (!hasContext) {
    return { prevHref: null, nextHref: null, position: null, total: null }
  }

  const page = Math.max(1, parseInt(ctx.page ?? "1", 10) || 1)
  const view: View = (VALID_VIEWS as readonly string[]).includes(ctx.view ?? "")
    ? (ctx.view as View)
    : "all"

  const sharedOpts = {
    limit: PAGE_SIZE,
    search: ctx.search?.trim() || undefined,
    ...buildViewFilter(view),
    priceMinUSD: parsePrice(ctx.priceMinUSD),
    priceMaxUSD: parsePrice(ctx.priceMaxUSD),
    priceMinMMK: parsePrice(ctx.priceMinMMK),
    priceMaxMMK: parsePrice(ctx.priceMaxMMK),
  }

  const { products, total } = await getAdminProductsFromDb({ page, ...sharedOpts })
  const idx = products.findIndex((r) => r.id === id)
  if (idx === -1) return { prevHref: null, nextHref: null, position: null, total: null }

  const position = (page - 1) * PAGE_SIZE + idx + 1

  let prevHref: string | null = null
  if (idx > 0) {
    prevHref = buildAdjacentHref(products[idx - 1].id, ctx, page)
  } else if (page > 1) {
    const prevResult = await getAdminProductsFromDb({ page: page - 1, ...sharedOpts })
    if (prevResult && prevResult.products.length > 0) {
      prevHref = buildAdjacentHref(prevResult.products[prevResult.products.length - 1].id, ctx, page - 1)
    }
  }

  let nextHref: string | null = null
  if (idx < products.length - 1) {
    nextHref = buildAdjacentHref(products[idx + 1].id, ctx, page)
  } else {
    const nextResult = await getAdminProductsFromDb({ page: page + 1, ...sharedOpts })
    if (nextResult && nextResult.products.length > 0) {
      nextHref = buildAdjacentHref(nextResult.products[0].id, ctx, page + 1)
    }
  }

  return { prevHref, nextHref, position, total }
}
