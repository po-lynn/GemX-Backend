import { cacheTag, cacheLife, revalidateTag } from "next/cache"
import { getGlobalTag } from "@/lib/dataCache"
import { getNewsCategoryCountsFromDb } from "../news"

function getNewsGlobalTag() {
  return getGlobalTag("news")
}

/**
 * Published-news counts per category, used for the mobile category chips.
 * Runs an unindexed GROUP BY on every call (no index on news.category) — cached short-TTL
 * so it's not re-run on every single /api/news request.
 */
export async function getCachedNewsCategoryCounts() {
  "use cache"
  cacheTag(getNewsGlobalTag())
  cacheLife({ stale: 30, revalidate: 30, expire: 90 })
  return getNewsCategoryCountsFromDb()
}

/**
 * Invalidate news cache (use in Server Actions / Route Handlers on create/update/delete).
 * Must use revalidateTag(tag, "max"), NOT updateTag — see revalidateProductsCache for why.
 */
export function revalidateNewsCache() {
  revalidateTag(getNewsGlobalTag(), "max")
}
