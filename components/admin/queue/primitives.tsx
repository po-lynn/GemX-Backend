"use client"

import type { CSSProperties, ReactNode } from "react"
import { QC, QC_TONES, type QueueToneKey } from "@/components/admin/queue/tokens"

export function Pill({ tone, children }: { tone: QueueToneKey; children: ReactNode }) {
  const t = QC_TONES[tone]
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11.5,
        fontWeight: 600,
        borderRadius: 99,
        padding: "3px 9px 3px 7px",
        background: t.bg,
        color: t.ink,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 99, background: t.ink, flexShrink: 0 }} />
      {children}
    </span>
  )
}

export function MonoChip({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        color: QC.inkMuted,
        background: QC.panel,
        border: `1px solid ${QC.borderDefault}`,
        borderRadius: 6,
        padding: "3px 7px",
        ...style,
      }}
    >
      {children}
    </span>
  )
}

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost"

const buttonBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  fontSize: 12.5,
  fontWeight: 600,
  borderRadius: 9,
  padding: "9px 14px",
  cursor: "pointer",
  border: "1px solid transparent",
  fontFamily: "inherit",
}

export function qcButtonStyle(variant: ButtonVariant, disabled?: boolean): CSSProperties {
  const opacity = disabled ? 0.55 : 1
  switch (variant) {
    case "primary":
      return { ...buttonBase, color: "#fff", background: QC.ink, boxShadow: "0 1px 2px rgba(23,19,14,.28)", opacity }
    case "danger":
      return { ...buttonBase, color: QC.dangerInk, background: QC.panel, border: `1px solid ${QC.dangerBorder}`, opacity }
    case "ghost":
      return { ...buttonBase, color: QC.inkMuted, background: "transparent", border: "none", padding: "7px 10px", opacity }
    case "secondary":
    default:
      return { ...buttonBase, color: QC.ink, background: QC.panel, border: `1px solid ${QC.borderStrong}`, opacity }
  }
}

export function Sparkline({ values, tone }: { values: number[]; tone: QueueToneKey }) {
  const max = Math.max(1, ...values)
  const activeInk = QC_TONES[tone].ink
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 2, height: 26 }}>
      {values.map((n, i) => (
        <div
          key={i}
          style={{
            width: 6,
            height: Math.max(3, Math.round((n / max) * 26)),
            borderRadius: 2,
            background: i === values.length - 1 ? activeInk : QC.borderDefault,
          }}
        />
      ))}
    </div>
  )
}

/** Area-filled line sparkline for the KPI cards (e.g. "Jobs processed" trend). */
export function AreaSparkline({ values, stroke }: { values: number[]; stroke: string }) {
  if (values.length < 2) return null
  const max = Math.max(1, ...values)
  const w = 200
  const h = 34
  const step = w / (values.length - 1)
  const points = values.map((v, i) => `${i * step},${h - (v / max) * (h - 4) - 2}`).join(" ")
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={stroke} strokeWidth={1.8} />
      <polyline points={`0,${h} ${points} ${w},${h}`} fill={`${stroke}14`} stroke="none" />
    </svg>
  )
}

export function Histogram({ values }: { values: number[] }) {
  const max = Math.max(1, ...values)
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 34 }}>
      {values.map((v, i) => {
        const isRecent = i >= values.length - 2
        return (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${Math.max(6, (v / max) * 100)}%`,
              background: isRecent ? QC.gold : i >= values.length - 4 ? QC.borderStrong : QC.borderHairline,
              borderRadius: 2,
            }}
          />
        )
      })}
    </div>
  )
}
