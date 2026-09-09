/** "12 Jan 2026" — the admin list-view date format used across every reference-data table. */
export function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

/** "3h ago", falling back to fmtDate() past a week. */
export function fmtRelative(d: Date): string {
  const diff = (Date.now() - new Date(d).getTime()) / 1000
  if (diff < 60)     return "just now"
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return fmtDate(d)
}

/** Builds the `?view=`/`?page=&view=` href pair every admin list-view page uses for its tabs and pagination. */
export function buildListViewHrefs(base: string) {
  return {
    buildViewHref(view: string): string {
      const p = new URLSearchParams()
      if (view !== "all") p.set("view", view)
      return p.toString() ? `${base}?${p}` : base
    },
    buildPageHref(pg: number, view: string): string {
      const p = new URLSearchParams()
      if (view !== "all") p.set("view", view)
      p.set("page", String(pg))
      return `${base}?${p}`
    },
  }
}
