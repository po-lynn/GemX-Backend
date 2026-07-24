const WHY_ITEMS = [
  {
    iconBg: "#f1ecff",
    iconColor: "#5B3DF5",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5B3DF5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/>
        <path d="M14 2v6h6"/><path d="m9 15 2 2 4-4"/>
      </svg>
    ),
    title: "Lab reports",
    body: "GIA, GRS & SSEF documentation on file.",
  },
  {
    iconBg: "#fdeaf4",
    iconColor: "#E8318A",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E8318A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5"/>
      </svg>
    ),
    title: "Verified sellers",
    body: "Vetted profiles you can buy from confidently.",
  },
  {
    iconBg: "#fbf3dc",
    iconColor: "#C9A227",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C9A227" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/>
      </svg>
    ),
    title: "Curated quality",
    body: "Every listing hand-reviewed before it goes live.",
  },
  {
    iconBg: "#e9f7f1",
    iconColor: "#12A374",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#12A374" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2 9.2 8.6 2 9.3l5.5 4.7L5.8 21 12 17.3 18.2 21l-1.7-7 5.5-4.7-7.2-.7z"/>
      </svg>
    ),
    title: "Premium assist",
    body: "Concierge sourcing for special requests.",
  },
]

export function TrustSection() {
  return (
    <section id="why" className="home-section-pad" style={{ padding: "80px 7vw 0" }}>
      <h2 style={{ margin: "0 0 5px", fontFamily: "var(--font-bricolage)", fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em", color: "#171326" }}>Why GemX</h2>
      <p style={{ margin: "0 0 24px", fontSize: 14, color: "#7b7593", maxWidth: 580 }}>
        A marketplace built on trust — the same standard for buyers and sellers.
      </p>
      <div className="home-why-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
        {WHY_ITEMS.map((item) => (
          <div
            key={item.title}
            className="home-why-card-hover"
            style={{
              border: "1px solid #eee7fa", borderRadius: 18, padding: 20,
              background: "#fff",
            }}
          >
            <div style={{
              width: 42, height: 42, borderRadius: 12, background: item.iconBg,
              display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14,
            }}>
              {item.icon}
            </div>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#171326" }}>{item.title}</div>
            <div style={{ fontSize: 12.5, color: "#8b86a2", marginTop: 5, lineHeight: 1.5 }}>{item.body}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
