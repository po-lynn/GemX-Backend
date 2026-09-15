/**
 * Design tokens for the Queue Console (Queue overview / detail / job drawer).
 * Scoped to these three screens only — the rest of the admin panel keeps its
 * existing purple/light theme (see app/globals.css --admin-sidebar-*); this
 * is a deliberately separate, higher-fidelity visual language per the
 * design_handoff_queue_console bundle.
 */

export const QC = {
  canvas: "#F4F3EF",
  panel: "#FFFFFF",
  subtle: "#FAF9F6",
  rowSelected: "#FBF7EC",

  borderDefault: "#E3E0D8",
  borderHairline: "#EFEDE7",
  borderRow: "#F3F1EB",
  borderStrong: "#D9D5CB",
  borderHover: "#C4BFB2",

  ink: "#17130E",
  ink2: "#3E3A33",
  inkMuted: "#6B6760",
  inkFaint: "#9A958C",
  inkDisabled: "#C4BFB2",

  gold: "#8F6A1C",
  goldHover: "#6E4F12",
  goldOnDark: "#D8A93C",
  goldPale: "#E8D5A6",
  goldTint: "#FBF7EC",

  dangerBorder: "#E6B7B2",
  dangerBg: "#FBE9E7",
  dangerInk: "#A8281F",

  bannerBg: "#FDF6E8",
  bannerBorder: "#EBD9AE",
  bannerRule: "#B98A16",
  bannerTitle: "#5E4508",
  bannerBody: "#7A5C10",

  traceBg: "#FDF7F6",
  traceBorder: "#F0CFCB",
  traceInk: "#7A241D",
} as const

export type QueueToneKey = "green" | "amber" | "red" | "blue" | "grey"

export const QC_TONES: Record<QueueToneKey, { bg: string; ink: string }> = {
  green: { bg: "#E7F3EC", ink: "#1C7A4F" },
  amber: { bg: "#FDF0DF", ink: "#A8620A" },
  red: { bg: "#FBE9E7", ink: "#A8281F" },
  blue: { bg: "#E8EEF8", ink: "#2B5CA8" },
  grey: { bg: "#F4F3EF", ink: "#6B6760" },
}

export type QueueHealth = "healthy" | "stale" | "failing" | "idle"

export const HEALTH_TONE: Record<QueueHealth, QueueToneKey> = {
  healthy: "green",
  stale: "amber",
  failing: "red",
  idle: "grey",
}

export const HEALTH_LABEL: Record<QueueHealth, string> = {
  healthy: "Healthy",
  stale: "Stale",
  failing: "Failing",
  idle: "Idle",
}

export type JobStatusKey = "pending" | "processing" | "completed" | "failed" | "cancelled"

/** A stale `processing` job renders with the amber "stale" tone even though its stored status is still "processing". */
export function statusTone(status: string, isStale: boolean): QueueToneKey {
  if (isStale) return "amber"
  switch (status) {
    case "completed":
      return "green"
    case "processing":
      return "blue"
    case "failed":
      return "red"
    case "cancelled":
      return "grey"
    default:
      return "grey"
  }
}

export function statusLabel(status: string, isStale: boolean): string {
  if (isStale && status === "processing") return "Stale"
  return status.charAt(0).toUpperCase() + status.slice(1)
}
