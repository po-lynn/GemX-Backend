import { getUsersPaginatedFromDb } from "@/features/users/db/users"

const PAGE_SIZE = 20

export type ListContext = {
  view?: string
  search?: string
  page?: string
}

export type AdjacentResult = {
  prevHref: string | null
  nextHref: string | null
  position: number | null
  total: number | null
}

function buildAdjacentHref(id: string, ctx: ListContext, page: number): string {
  const p = new URLSearchParams()
  if (ctx.view && ctx.view !== "all") p.set("view", ctx.view)
  if (ctx.search?.trim()) p.set("search", ctx.search.trim())
  p.set("page", String(page))
  const qs = p.toString()
  return `/admin/users/${id}/edit${qs ? `?${qs}` : ""}`
}

export async function resolveAdjacentUsers(
  id: string,
  ctx: ListContext,
): Promise<AdjacentResult> {
  const hasContext =
    ctx.view !== undefined ||
    ctx.search !== undefined ||
    ctx.page !== undefined

  if (!hasContext) {
    return { prevHref: null, nextHref: null, position: null, total: null }
  }

  const page = Math.max(1, parseInt(ctx.page ?? "1", 10) || 1)

  const sharedOpts = {
    limit: PAGE_SIZE,
    search: ctx.search?.trim() || undefined,
    view: ctx.view,
  }

  const { users, total } = await getUsersPaginatedFromDb({ page, ...sharedOpts })
  const idx = users.findIndex((u) => u.id === id)
  if (idx === -1) return { prevHref: null, nextHref: null, position: null, total: null }

  const position = (page - 1) * PAGE_SIZE + idx + 1

  let prevHref: string | null = null
  if (idx > 0) {
    prevHref = buildAdjacentHref(users[idx - 1].id, ctx, page)
  } else if (page > 1) {
    const prevResult = await getUsersPaginatedFromDb({ page: page - 1, ...sharedOpts })
    if (prevResult.users.length > 0) {
      prevHref = buildAdjacentHref(prevResult.users[prevResult.users.length - 1].id, ctx, page - 1)
    }
  }

  let nextHref: string | null = null
  if (idx < users.length - 1) {
    nextHref = buildAdjacentHref(users[idx + 1].id, ctx, page)
  } else {
    const nextResult = await getUsersPaginatedFromDb({ page: page + 1, ...sharedOpts })
    if (nextResult.users.length > 0) {
      nextHref = buildAdjacentHref(nextResult.users[0].id, ctx, page + 1)
    }
  }

  return { prevHref, nextHref, position, total }
}
