import Link from "next/link"
import HomeNavbarAuthButton from "@/components/home/HomeNavbarAuthButton"

export function HomeNavbar() {
  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 50,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "16px 7vw",
      background: "rgba(247,245,255,0.86)",
      backdropFilter: "blur(14px)",
      borderBottom: "1px solid #eee7fa",
    }}>
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 11, textDecoration: "none" }}>
        <span style={{
          width: 32, height: 32, borderRadius: 9,
          background: "linear-gradient(135deg,#5B3DF5,#E8318A)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: 16,
          flexShrink: 0,
        }}>◈</span>
        <span style={{ fontFamily: "var(--font-bricolage)", fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", color: "#171326" }}>GemX</span>
      </Link>

      <nav className="home-navbar-nav" style={{ display: "flex", alignItems: "center", gap: 34 }}>
        <Link href="#why" className="home-nav-link" style={{ fontSize: "14.5px", fontWeight: 600, color: "#5f5a72", textDecoration: "none" }}>Why GemX</Link>
        <Link href="#app" className="home-nav-link" style={{ fontSize: "14.5px", fontWeight: 600, color: "#5f5a72", textDecoration: "none" }}>Download app</Link>
        <Link href="#contact" className="home-nav-link" style={{ fontSize: "14.5px", fontWeight: 600, color: "#5f5a72", textDecoration: "none" }}>Contact us</Link>
      </nav>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <HomeNavbarAuthButton />
        <Link href="#app" style={{
          fontSize: 14, fontWeight: 700, color: "#fff",
          background: "#171326", padding: "10px 18px", borderRadius: 99,
          boxShadow: "0 4px 12px rgba(23,19,38,0.25)", textDecoration: "none",
        }}>Get the app</Link>
      </div>
    </header>
  )
}
