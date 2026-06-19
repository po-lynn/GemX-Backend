"use client"

import { useState } from "react"

const ACCENT = "#6d5ce7"
type Range = "7D" | "30D" | "90D"

const SERIES: Record<Range, number[]> = {
  "7D":  [12, 19, 14, 23, 18, 28, 24],
  "30D": [14, 11, 17, 15, 22, 19, 25, 21, 28, 24],
  "90D": [9, 13, 11, 16, 14, 20, 18, 23, 21, 26, 24, 29],
}

const LABELS: Record<Range, string[]> = {
  "7D":  ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  "30D": ["1", "4", "7", "10", "13", "16", "19", "22", "25", "28"],
  "90D": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
}

function buildChart(values: number[]) {
  const W = 660, H = 240, px = 16, pt = 24, pb = 34
  const max = Math.max(...values) * 1.18
  const n = values.length
  const sx = (W - px * 2) / (n - 1)
  const pts: [number, number][] = values.map((v, i) => [
    px + i * sx,
    pt + (1 - v / max) * (H - pt - pb),
  ])
  const t = 0.16
  let line = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1x = p1[0] + (p2[0] - p0[0]) * t
    const c1y = p1[1] + (p2[1] - p0[1]) * t
    const c2x = p2[0] - (p3[0] - p1[0]) * t
    const c2y = p2[1] - (p3[1] - p1[1]) * t
    line += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`
  }
  const last = pts[pts.length - 1]
  const area = `${line} L${last[0].toFixed(1)},${H - pb} L${pts[0][0].toFixed(1)},${H - pb} Z`
  return { line, area, last }
}

export function DashboardActivityChart() {
  const [range, setRange] = useState<Range>("7D")
  const { line, area, last } = buildChart(SERIES[range])
  const labels = LABELS[range]

  return (
    <div style={{ background: "#fff", border: "1px solid #ededf2", borderRadius: 16, padding: "22px 22px 16px", boxShadow: "0 1px 3px rgba(20,15,40,0.04)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#191525" }}>Marketplace Activity</div>
          <div style={{ fontSize: 12.5, color: "#8a8799", marginTop: 3 }}>Transactions &amp; listings over time</div>
        </div>
        <div style={{ display: "flex", gap: 3, background: "#f4f4f8", borderRadius: 10, padding: 3 }}>
          {(["7D", "30D", "90D"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                padding: "6px 14px",
                fontSize: 12.5,
                fontWeight: 700,
                borderRadius: 8,
                cursor: "pointer",
                border: "none",
                fontFamily: "inherit",
                transition: "all .15s",
                background: range === r ? ACCENT : "transparent",
                color: range === r ? "#fff" : "#8a8799",
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 10, margin: "10px 0 2px" }}>
        <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", color: "#191525" }}>152</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#0f9d6b" }}>+18.2% vs prev. period</span>
      </div>

      <svg viewBox="0 0 660 240" preserveAspectRatio="none" width="100%" height="240" style={{ display: "block", overflow: "visible" }}>
        <defs>
          <linearGradient id="dashAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity={0.22} />
            <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
          </linearGradient>
        </defs>
        {[40, 93, 146, 199].map((y) => (
          <line key={y} x1="16" y1={y} x2="644" y2={y} stroke="#f0eff5" strokeWidth="1" />
        ))}
        <path d={area} fill="url(#dashAreaGrad)" />
        <path d={line} fill="none" stroke={ACCENT} strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={last[0]} cy={last[1]} r="5.5" fill="#fff" stroke={ACCENT} strokeWidth="3" />
      </svg>

      <div style={{ display: "flex", justifyContent: "space-between", padding: "0 14px", marginTop: 2 }}>
        {labels.map((lab) => (
          <span key={lab} style={{ fontSize: 11.5, color: "#a6a3b8", fontWeight: 500 }}>{lab}</span>
        ))}
      </div>
    </div>
  )
}
