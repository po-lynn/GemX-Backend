import Link from "next/link"

const LINKS = [
  { href: "#app", label: "Download app" },
  { href: "#why", label: "Why Us" },
  { href: "#contact", label: "Contact us" },
  { href: "/login", label: "Sign in" },
  { href: "/admin", label: "Admin" },
]

export function HomeFooter() {
  return (
    <footer className="home-footer" style={{
      padding: "36px 7vw",
      borderTop: "1px solid #f0eff5",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 20, flexWrap: "wrap",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 9,
          background: "linear-gradient(135deg,#7b67ee,#9a86ff)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 3h12l4 6-10 13L2 9Z"/>
          </svg>
        </div>
        <span style={{ fontSize: 16, fontWeight: 800, color: "#191525" }}>GemX</span>
      </div>

      <nav style={{ display: "flex", gap: 26, fontSize: "13.5px", fontWeight: 600, color: "#56536a", flexWrap: "wrap" }}>
        {LINKS.map(({ href, label }) => (
          <Link key={label} href={href} className="home-nav-link" style={{ color: "#56536a", textDecoration: "none" }}>
            {label}
          </Link>
        ))}
      </nav>

      <span style={{ fontSize: "12.5px", color: "#a6a3b8" }}>© 2026 GemX. Premium gemstone &amp; jewellery marketplace.</span>
    </footer>
  )
}
