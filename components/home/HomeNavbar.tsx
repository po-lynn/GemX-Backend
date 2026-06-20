import Link from "next/link"

export function HomeNavbar() {
  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 50,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "18px 7vw",
      background: "rgba(255,255,255,0.85)",
      backdropFilter: "blur(14px)",
      borderBottom: "1px solid #f0eff5",
    }}>
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 11, textDecoration: "none" }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10,
          background: "linear-gradient(135deg,#7b67ee,#9a86ff)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 12px rgba(109,92,231,0.35)",
          flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/>
          </svg>
        </div>
        <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", color: "#191525" }}>GemX</span>
      </Link>

      <nav className="home-navbar-nav" style={{ display: "flex", alignItems: "center", gap: 34 }}>
        <Link href="#why" className="home-nav-link" style={{ fontSize: "14.5px", fontWeight: 600, color: "#56536a", textDecoration: "none" }}>Why GemX</Link>
        <Link href="#app" className="home-nav-link" style={{ fontSize: "14.5px", fontWeight: 600, color: "#56536a", textDecoration: "none" }}>Download app</Link>
        <Link href="#contact" className="home-nav-link" style={{ fontSize: "14.5px", fontWeight: 600, color: "#56536a", textDecoration: "none" }}>Contact us</Link>
      </nav>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Link href="/login" className="home-navbar-signin" style={{ fontSize: "14.5px", fontWeight: 600, color: "#191525", textDecoration: "none" }}>Sign in</Link>
        <Link href="#app" style={{
          fontSize: 14, fontWeight: 700, color: "#fff",
          background: "#6d5ce7", padding: "10px 18px", borderRadius: 10,
          boxShadow: "0 4px 12px rgba(109,92,231,0.3)", textDecoration: "none",
        }}>Get the app</Link>
      </div>
    </header>
  )
}
