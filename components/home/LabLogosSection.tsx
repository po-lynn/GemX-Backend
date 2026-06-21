interface Props {
  labs: string[]
}

export function LabLogosSection({ labs }: Props) {
  const display = labs.length > 0 ? labs : ["GIA", "GRS", "AGL", "Gübelin", "SSEF"]
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      gap: 46, padding: "22px 7vw",
      borderTop: "1px solid #f3f2f7", borderBottom: "1px solid #f3f2f7",
      background: "#fafafc", flexWrap: "wrap",
    }}>
      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", color: "#a6a3b8", textTransform: "uppercase" }}>
        Lab reports from
      </span>
      {display.map((lab) => (
        <span key={lab} style={{ fontSize: 18, fontWeight: 700, color: "#bdbace", letterSpacing: ".04em" }}>
          {lab}
        </span>
      ))}
    </div>
  )
}
