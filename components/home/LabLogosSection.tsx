import { Fragment } from "react"

interface Props {
  labs: string[]
}

function parseLab(raw: string): { abbr: string; subtitle: string } {
  const match = raw.match(/^(.*?)\s*\(([^)]+)\)\s*$/)
  if (match) return { abbr: match[1], subtitle: match[2] }
  return { abbr: raw, subtitle: "" }
}

export function LabLogosSection({ labs }: Props) {
  const display = (labs.length > 0 ? labs : ["GIA (Gemological Institute)", "GRS (GemResearch)", "SSEF (Swiss Foundation)"]).map(parseLab)

  return (
    <div style={{ padding: "18px 7vw", background: "#fff", borderTop: "1px solid #f0ecfb", borderBottom: "1px solid #f0ecfb" }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "#a49fbb", marginBottom: 12 }}>
        Lab reports from
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        {display.map((lab, i) => (
          <Fragment key={lab.abbr + i}>
            <div style={{ textAlign: "center", flex: 1 }}>
              <div style={{ fontFamily: "var(--font-bricolage)", fontWeight: 800, fontSize: 18, color: "#171326" }}>{lab.abbr}</div>
              {lab.subtitle && <div style={{ fontSize: 9, color: "#9a95b0" }}>{lab.subtitle}</div>}
            </div>
            {i < display.length - 1 && <div style={{ width: 1, background: "#eee" }} />}
          </Fragment>
        ))}
      </div>
    </div>
  )
}
