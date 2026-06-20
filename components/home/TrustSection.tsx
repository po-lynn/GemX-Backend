const WHY_ITEMS = [
  {
    iconBg: "#efeafe",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6d5ce7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/>
        <path d="M14 2v6h6"/><path d="m9 15 2 2 4-4"/>
      </svg>
    ),
    title: "Lab reports",
    body: "Certified stones with GIA, GRS and trusted lab documentation when available.",
  },
  {
    iconBg: "#e7f0ff",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b7df6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
      </svg>
    ),
    title: "Verified sellers",
    body: "Transparent profiles and moderation, so you buy with confidence.",
  },
  {
    iconBg: "#e7f7ef",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0f9d6b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/>
      </svg>
    ),
    title: "Curated quality",
    body: "From collector pieces to everyday jewellery — each listing is vetted.",
  },
  {
    iconBg: "#fef3e2",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#e08a17" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="6"/><path d="M15.5 13.5 17 22l-5-3-5 3 1.5-8.5"/>
      </svg>
    ),
    title: "Premium assist",
    body: "Optional white-glove service for high-value and special requests.",
  },
]

export function TrustSection() {
  return (
    <section id="why" style={{ padding: "84px 7vw 0" }}>
      <h2 style={{ margin: "0 0 5px", fontSize: 34, fontWeight: 800, letterSpacing: "-0.025em", color: "#191525" }}>Why GemX</h2>
      <p style={{ margin: "0 0 26px", fontSize: 15, color: "#8a8799", maxWidth: 580 }}>
        A marketplace built for trust: certified gemstones, clear documentation, and sellers who care about the same standards you do.
      </p>
      <div className="home-why-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 20 }}>
        {WHY_ITEMS.map((item) => (
          <div
            key={item.title}
            className="home-why-card-hover"
            style={{
              border: "1px solid #ededf2", borderRadius: 16, padding: 24,
              background: "#fff", boxShadow: "0 1px 3px rgba(20,15,40,0.04)",
            }}
          >
            <div style={{
              width: 46, height: 46, borderRadius: 13, background: item.iconBg,
              display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 15,
            }}>
              {item.icon}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#191525" }}>{item.title}</div>
            <div style={{ fontSize: 13, color: "#8a8799", marginTop: 6, lineHeight: 1.55 }}>{item.body}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
