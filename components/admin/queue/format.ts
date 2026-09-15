/** "newlyGranted" -> "Newly Granted" */
export function formatResultLabel(key: string): string {
  const spaced = key.replace(/([A-Z])/g, " $1")
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export function formatResultValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (typeof value === "number") return value.toLocaleString()
  if (value === null || value === undefined) return "—"
  return String(value)
}

export function fmtDate(d: string | null): string {
  if (!d) return "—"
  return new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
}

/** 128000 -> "2m 08s"; 900 -> "0.9s"; null -> "—". */
export function fmtDurationMs(ms: number | null): string {
  if (ms == null) return "—"
  if (ms < 1000) return `${ms}ms`
  const totalSeconds = Math.round(ms / 1000)
  if (totalSeconds < 60) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes < 60) return `${minutes}m ${String(seconds).padStart(2, "0")}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

/** Run time between two ISO timestamps, or "—" if either is missing. */
export function fmtRunTime(createdAt: string, finishedAt: string | null): string {
  if (!finishedAt) return "—"
  return fmtDurationMs(new Date(finishedAt).getTime() - new Date(createdAt).getTime())
}

/** Age in ms -> "2m ago" / "42m ago" / "6h ago" / "3d ago"; null -> "—". */
export function fmtRelative(msAgo: number | null): string {
  if (msAgo == null) return "—"
  const seconds = Math.max(0, Math.round(msAgo / 1000))
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

/** ISO timestamp -> "2m ago", relative to now. */
export function fmtRelativeFrom(iso: string | null): string {
  if (!iso) return "—"
  return fmtRelative(Date.now() - new Date(iso).getTime())
}

/** "Surprise Bonus" -> "SB"; "Push Notifications" -> "PN". */
export function initials(label: string): string {
  const words = label.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return "?"
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}
