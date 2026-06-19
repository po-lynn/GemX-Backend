"use client"

import { useRouter, usePathname } from "next/navigation"
import { useState, useEffect, useRef } from "react"

const RANGES = [
  { label: "Last 7 days",  value: "7d"  },
  { label: "Last 30 days", value: "30d" },
  { label: "Last 90 days", value: "90d" },
]

export function DashboardRangePicker({ current }: { current: string }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const currentLabel = RANGES.find(r => r.value === current)?.label ?? "Last 7 days"

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  function select(value: string) {
    setOpen(false)
    router.push(`${pathname}?range=${value}`)
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "#fff", border: "1px solid #ededf2", borderRadius: 10,
          padding: "9px 13px", fontSize: 13, fontWeight: 600, color: "#56536a",
          cursor: "pointer", fontFamily: "inherit",
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9b98ab" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
        </svg>
        {currentLabel}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9b98ab" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform .15s" }}>
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0,
          background: "#fff", border: "1px solid #ededf2", borderRadius: 12,
          padding: 6, boxShadow: "0 4px 20px rgba(20,15,40,0.12)", zIndex: 50, minWidth: 164,
        }}>
          {RANGES.map(r => (
            <button
              key={r.value}
              onClick={() => select(r.value)}
              style={{
                display: "block", width: "100%", textAlign: "left",
                padding: "9px 12px", fontSize: 13,
                fontWeight: current === r.value ? 700 : 500,
                color: current === r.value ? "#6d5ce7" : "#56536a",
                background: current === r.value ? "#f3f0fe" : "transparent",
                borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit",
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
