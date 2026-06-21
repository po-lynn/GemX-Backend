import Link from "next/link"

export function HeroSection() {
  return (
    <section className="home-hero-section" style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      textAlign: "center",
      padding: "96px 7vw 80px",
      background: "radial-gradient(120% 120% at 50% 0%,#f6f4ff 0%,#ffffff 60%)",
    }}>
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        fontSize: "12.5px", fontWeight: 700, color: "#6d5ce7",
        background: "#efeafe", padding: "7px 14px", borderRadius: 20,
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2 9.2 8.6 2 9.3l5.5 4.7L5.8 21 12 17.3 18.2 21l-1.7-7 5.5-4.7-7.2-.7z"/>
        </svg>
        Certified gemstones &amp; fine jewellery
      </span>

      <h1 className="home-hero-title" style={{ margin: "24px 0 0", fontSize: 68, lineHeight: 1.03, fontWeight: 800, letterSpacing: "-0.03em", color: "#191525" }}>
        Where rarity meets <span style={{ color: "#6d5ce7" }}>trust</span>
      </h1>

      <p style={{ margin: "20px 0 0", fontSize: 18, lineHeight: 1.65, color: "#56536a", maxWidth: 520 }}>
        Discover certified loose gemstones and handcrafted jewellery. Lab reports, transparent sellers, and a marketplace built for collectors who care about provenance.
      </p>

      <div style={{ display: "flex", gap: 13, marginTop: 36, flexWrap: "wrap", justifyContent: "center" }}>
        <Link href="#app" style={{
          fontSize: 15, fontWeight: 700, color: "#fff", background: "#6d5ce7",
          padding: "14px 28px", borderRadius: 12,
          boxShadow: "0 8px 20px rgba(109,92,231,0.32)", textDecoration: "none",
        }}>Download mobile app</Link>
        <Link href="#why" style={{
          fontSize: 15, fontWeight: 700, color: "#191525", background: "#fff",
          border: "1px solid #e6e4ee", padding: "14px 28px", borderRadius: 12, textDecoration: "none",
        }}>Why GemX</Link>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 36 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 36, height: 36, borderRadius: "50%", background: "#efeafe", flexShrink: 0,
        }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#6d5ce7" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/>
          </svg>
        </span>
        <div style={{ textAlign: "left" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#191525" }}>Launching soon</div>
          <div style={{ fontSize: 13, color: "#56536a", marginTop: 1 }}>Every stone lab-documented &amp; verified at launch</div>
        </div>
      </div>
    </section>
  )
}
