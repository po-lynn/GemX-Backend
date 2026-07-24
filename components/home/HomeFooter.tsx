import Link from "next/link"

const LINKS = [
  { href: "#app", label: "Download app" },
  { href: "#why", label: "Why Us" },
  { href: "#contact", label: "Contact us" },
  { href: "/login", label: "Sign in" },
]

export function HomeFooter() {
  return (
    <footer className="home-footer" style={{
      padding: "32px 7vw",
      background: "#171326", color: "#cfc9e6",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 20, flexWrap: "wrap",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{
          width: 28, height: 28, borderRadius: 8,
          background: "linear-gradient(135deg,#5B3DF5,#E8318A)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: 14,
        }}>◈</span>
        <span style={{ fontFamily: "var(--font-bricolage)", fontSize: 16, fontWeight: 800, color: "#fff" }}>GemX</span>
      </div>

      <nav style={{ display: "flex", gap: 26, fontSize: "13.5px", fontWeight: 600, color: "#cfc9e6", flexWrap: "wrap" }}>
        {LINKS.map(({ href, label }) => (
          <Link key={label} href={href} className="home-nav-link" style={{ color: "#cfc9e6", textDecoration: "none" }}>
            {label}
          </Link>
        ))}
      </nav>

      <span style={{ fontSize: "12px", color: "#7d769c" }}>© 2026 GemX. Certified gemstones &amp; fine jewellery.</span>
    </footer>
  )
}
