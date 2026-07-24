import Link from "next/link"

export function HeroSection() {
  return (
    <section className="home-hero-section" style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      textAlign: "center",
      padding: "88px 7vw 76px",
    }}>
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        fontSize: "12px", fontWeight: 700, color: "#5B3DF5",
        background: "#fff", border: "1px solid #ece6fb",
        padding: "7px 14px", borderRadius: 99, textTransform: "uppercase", letterSpacing: "0.07em",
      }}>
        ✦ Verified provenance
      </span>

      <h1 className="home-hero-title" style={{
        margin: "22px 0 0", fontFamily: "var(--font-bricolage)",
        fontSize: 66, lineHeight: 1.04, fontWeight: 800, letterSpacing: "-0.03em", color: "#171326",
      }}>
        Where rarity meets{" "}
        <span style={{
          background: "linear-gradient(120deg,#5B3DF5,#E8318A)",
          WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
        }}>trust</span>.
      </h1>

      <p style={{ margin: "20px 0 0", fontSize: 18, lineHeight: 1.6, color: "#5f5a72", maxWidth: 560 }}>
        The marketplace for certified loose gemstones and handcrafted jewellery — lab-verified, seller-vetted, built for collectors who care about provenance.
      </p>

      <div className="home-hero-actions" style={{ display: "flex", gap: 13, marginTop: 34, flexWrap: "wrap", justifyContent: "center" }}>
        <Link href="#app" style={{
          fontSize: 15, fontWeight: 800, color: "#fff",
          background: "linear-gradient(90deg,#5B3DF5,#7C3AED)",
          padding: "15px 30px", borderRadius: 14,
          boxShadow: "0 14px 30px -10px rgba(91,61,245,.6)", textDecoration: "none",
        }}>Download the app</Link>
        <Link href="#why" style={{
          fontSize: 15, fontWeight: 700, color: "#171326", background: "#fff",
          border: "1px solid #ded7f4", padding: "14px 29px", borderRadius: 14, textDecoration: "none",
        }}>Why GemX →</Link>
      </div>
    </section>
  )
}
