export function ContactSection() {
  return (
    <section id="contact" style={{ padding: "84px 7vw 0" }}>
      <div className="home-contact-grid" style={{
        border: "1px solid #ededf2", borderRadius: 24, background: "#fff",
        boxShadow: "0 1px 3px rgba(20,15,40,0.04)", padding: 48,
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 44, alignItems: "center",
      }}>
        {/* Left: info */}
        <div>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            fontSize: "12.5px", fontWeight: 700, color: "#6d5ce7",
            background: "#efeafe", padding: "7px 14px", borderRadius: 20,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            We&apos;re here to help
          </span>
          <h2 style={{ margin: "18px 0 0", fontSize: 34, fontWeight: 800, letterSpacing: "-0.025em", color: "#191525" }}>Contact us</h2>
          <p style={{ margin: "14px 0 0", fontSize: 15, color: "#56536a", lineHeight: 1.6, maxWidth: 420 }}>
            Questions about a piece, sourcing a specific stone, or selling on GemX? Our team replies within one business day.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 26 }}>
            <a href="mailto:hello@gemxpremium.com" style={{ display: "flex", alignItems: "center", gap: 13, textDecoration: "none" }}>
              <span style={{
                width: 44, height: 44, borderRadius: 12, background: "#efeafe",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6d5ce7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/>
                </svg>
              </span>
              <span>
                <span style={{ display: "block", fontSize: 12, color: "#8a8799", fontWeight: 600 }}>Email</span>
                <span style={{ display: "block", fontSize: 15, fontWeight: 700, color: "#191525" }}>hello@gemxpremium.com</span>
              </span>
            </a>

            <a href="#" style={{ display: "flex", alignItems: "center", gap: 13, textDecoration: "none" }}>
              <span style={{
                width: 44, height: 44, borderRadius: 12, background: "#e7f7ef",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0f9d6b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
              </span>
              <span>
                <span style={{ display: "block", fontSize: 12, color: "#8a8799", fontWeight: 600 }}>WhatsApp &amp; phone</span>
                <span style={{ display: "block", fontSize: 15, fontWeight: 700, color: "#191525" }}>+95 9 000 000 000</span>
              </span>
            </a>
          </div>
        </div>

        {/* Right: form */}
        <form style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="home-contact-form-row" style={{ display: "flex", gap: 14 }}>
            <input
              placeholder="Your name"
              className="home-contact-input"
              style={{
                flex: 1, fontFamily: "inherit", fontSize: 14, color: "#191525",
                background: "#f7f6fb", border: "1px solid #ececf4", borderRadius: 12,
                padding: "14px 16px", outline: "none",
              }}
            />
            <input
              placeholder="Email"
              type="email"
              className="home-contact-input"
              style={{
                flex: 1, fontFamily: "inherit", fontSize: 14, color: "#191525",
                background: "#f7f6fb", border: "1px solid #ececf4", borderRadius: 12,
                padding: "14px 16px", outline: "none",
              }}
            />
          </div>
          <input
            placeholder="Subject"
            className="home-contact-input"
            style={{
              fontFamily: "inherit", fontSize: 14, color: "#191525",
              background: "#f7f6fb", border: "1px solid #ececf4", borderRadius: 12,
              padding: "14px 16px", outline: "none",
            }}
          />
          <textarea
            placeholder="How can we help?"
            rows={4}
            className="home-contact-input"
            style={{
              fontFamily: "inherit", fontSize: 14, color: "#191525",
              background: "#f7f6fb", border: "1px solid #ececf4", borderRadius: 12,
              padding: "14px 16px", outline: "none", resize: "vertical",
            }}
          />
          <button
            type="button"
            style={{
              alignSelf: "flex-start", fontSize: 15, fontWeight: 700, color: "#fff",
              background: "#6d5ce7", border: "none", padding: "14px 28px", borderRadius: 12,
              cursor: "pointer", fontFamily: "inherit", boxShadow: "0 8px 20px rgba(109,92,231,0.3)",
            }}
          >
            Send message
          </button>
        </form>
      </div>
    </section>
  )
}
