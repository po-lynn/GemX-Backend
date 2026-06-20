export function CTASection() {
  return (
    <section style={{ padding: "84px 7vw" }}>
      <div className="home-cta-inner" style={{
        borderRadius: 24, overflow: "hidden",
        background: "linear-gradient(120deg,#6d5ce7,#9a86ff)",
        padding: 64, textAlign: "center", color: "#fff",
      }}>
        <h2 className="home-cta-title" style={{ margin: 0, fontSize: 38, fontWeight: 800, letterSpacing: "-0.025em" }}>
          Get the app to view &amp; sell
        </h2>
        <p style={{ margin: "16px auto 0", fontSize: 16, maxWidth: 540, color: "#efeaff", lineHeight: 1.6 }}>
          Browse products, create listings, and manage your store from your phone — on iOS or Android.
        </p>
        <div style={{ marginTop: 30 }}>
          <a
            href="#app"
            className="home-lift-hover"
            style={{
              fontSize: 15, fontWeight: 700, color: "#6d5ce7", background: "#fff",
              padding: "15px 30px", borderRadius: 13,
              boxShadow: "0 10px 24px rgba(20,15,40,0.2)", display: "inline-block",
              textDecoration: "none",
            }}
          >
            Download mobile app
          </a>
        </div>
      </div>
    </section>
  )
}
