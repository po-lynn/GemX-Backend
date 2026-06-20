export function MobileAppSection() {
  return (
    <section id="app" style={{ padding: "84px 7vw 0" }}>
      <div className="home-app-inner home-app-grid" style={{
        borderRadius: 24, background: "#f6f4fc", border: "1px solid #ece9f9",
        padding: 52, display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 44, alignItems: "center",
      }}>
        {/* Left: copy */}
        <div>
          <div style={{
            width: 48, height: 48, borderRadius: 13, background: "#efeafe",
            display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18,
          }}>
            <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#6d5ce7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="2" width="14" height="20" rx="3"/><path d="M12 18h.01"/>
            </svg>
          </div>
          <h2 style={{ margin: 0, fontSize: 33, fontWeight: 800, letterSpacing: "-0.025em", color: "#191525", lineHeight: 1.1 }}>
            View, create &amp; manage<br />products on the go
          </h2>
          <p style={{ margin: "16px 0 0", fontSize: 15, color: "#56536a", lineHeight: 1.6, maxWidth: 430 }}>
            Browse certified gemstones and jewellery, list your own pieces, and manage your store from anywhere.
          </p>

          <div style={{ display: "flex", gap: 22, marginTop: 22, flexWrap: "wrap" }}>
            {[
              { label: "View listings", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6d5ce7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg> },
              { label: "Create products", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6d5ce7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/></svg> },
              { label: "Manage your store", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6d5ce7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 7h20l-2 5H4Z"/><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/></svg> },
            ].map(({ label, icon }) => (
              <span key={label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "13.5px", fontWeight: 600, color: "#56536a" }}>
                {icon}{label}
              </span>
            ))}
          </div>

          <div style={{ display: "flex", gap: 13, marginTop: 26, flexWrap: "wrap" }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 9,
              fontSize: 14, fontWeight: 700, color: "#fff", background: "#191525",
              padding: "13px 22px", borderRadius: 12, cursor: "default",
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
                <path d="M16.5 1.4c0 1.1-.4 2.1-1.2 3-.9 1-2 1.6-3.1 1.5-.1-1.1.4-2.2 1.1-3 .8-.9 2.1-1.5 3.2-1.5zM20 17.2c-.6 1.4-.9 2-1.7 3.2-1.1 1.7-2.7 3.8-4.6 3.8-1.7 0-2.1-1.1-4.4-1.1-2.3 0-2.8 1.1-4.4 1.1-1.9 0-3.4-1.9-4.5-3.6C-.2 17.4-.5 12 1.4 9.1 2.7 7 4.9 5.7 7 5.7c2 0 3.2 1.1 4.8 1.1 1.6 0 2.5-1.1 4.8-1.1 1.8 0 3.7 1 5.1 2.7-4.5 2.4-3.8 8.8.3 8.8z"/>
              </svg>
              App Store
            </span>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 9,
              fontSize: 14, fontWeight: 700, color: "#191525", background: "#fff",
              border: "1px solid #e0ddee", padding: "13px 22px", borderRadius: 12, cursor: "default",
            }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#6d5ce7" strokeWidth="1.8" strokeLinejoin="round">
                <path d="m3 3 16 9-16 9z"/>
              </svg>
              Google Play
            </span>
          </div>
          <p style={{ margin: "16px 0 0", fontSize: 12, color: "#a6a3b8", maxWidth: 420 }}>
            Links go live when the app is published. Use the web admin to manage products in the meantime.
          </p>
        </div>

        {/* Right: phone mockup */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={{
            width: 236, height: 478, borderRadius: 40, background: "#191525",
            border: "9px solid #191525", boxShadow: "0 24px 50px rgba(20,15,40,0.22)",
            overflow: "hidden", position: "relative",
          }}>
            <div style={{
              position: "absolute", inset: 0, borderRadius: 31, overflow: "hidden",
              background: "#f4f4f8", display: "flex", flexDirection: "column",
            }}>
              {/* App bar */}
              <div style={{ background: "#fff", padding: "14px 16px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: 7,
                      background: "linear-gradient(135deg,#7b67ee,#9a86ff)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 3h12l4 6-10 13L2 9Z"/>
                      </svg>
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 800, color: "#191525" }}>GemX</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      width: 24, height: 24, borderRadius: "50%", background: "#f1f0f6",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#56536a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                      </svg>
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#6d5ce7", background: "#efeafe", padding: "4px 9px", borderRadius: 20 }}>Points</span>
                  </div>
                </div>
              </div>

              {/* Scroll body */}
              <div style={{ flex: 1, padding: 12, display: "flex", flexDirection: "column", gap: 11, overflow: "hidden" }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", color: "#191525" }}>Rare &amp; investment grade</div>
                <div style={{
                  borderRadius: 14, aspectRatio: "16/10",
                  background: "linear-gradient(150deg,#ece8fb,#cbbff5)",
                  display: "flex", alignItems: "flex-end", padding: 11,
                }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#473a7a" }}>Certified gemstones</div>
                    <div style={{ fontSize: 9, color: "#6b5fa0", marginTop: 1 }}>Lab reports included</div>
                  </div>
                </div>
                <div style={{
                  borderRadius: 14, background: "linear-gradient(135deg,#6d5ce7,#9a86ff)",
                  padding: 13, color: "#fff",
                }}>
                  <div style={{ fontSize: "11.5px", fontWeight: 800 }}>Tell us what you seek</div>
                  <div style={{ fontSize: "9.5px", color: "#efeaff", marginTop: 2, lineHeight: 1.4 }}>We source it within 72 hours.</div>
                  <div style={{ marginTop: 9, display: "inline-block", fontSize: "9.5px", fontWeight: 700, color: "#6d5ce7", background: "#fff", padding: "5px 12px", borderRadius: 20 }}>Start a deal</div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  {[
                    "linear-gradient(150deg,#f6c7d0,#d4677c)",
                    "linear-gradient(150deg,#cdeedd,#5bb98c)",
                  ].map((g, i) => (
                    <div key={i} style={{ flex: 1, borderRadius: 12, background: "#fff", border: "1px solid #ededf2", overflow: "hidden" }}>
                      <div style={{ aspectRatio: "1/1", background: g }} />
                      <div style={{ padding: "7px 8px 9px" }}>
                        <div style={{ height: 6, width: "70%", borderRadius: 4, background: "#e7e5ee" }} />
                        <div style={{ height: 6, width: "45%", borderRadius: 4, background: "#efeafe", marginTop: 5 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom nav */}
              <div style={{
                background: "#fff", borderTop: "1px solid #ededf2",
                padding: "9px 22px 12px", display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#6d5ce7" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#b3b0c2" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                <div style={{
                  width: 40, height: 40, borderRadius: "50%",
                  background: "linear-gradient(135deg,#7b67ee,#9a86ff)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 6px 14px rgba(109,92,231,0.4)", marginTop: -26,
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                </div>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#b3b0c2" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#b3b0c2" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>
              </div>
            </div>
            {/* Notch */}
            <div style={{
              position: "absolute", top: 9, left: "50%", transform: "translateX(-50%)",
              width: 74, height: 5, borderRadius: 5, background: "rgba(255,255,255,0.6)", zIndex: 2,
            }} />
          </div>
        </div>
      </div>
    </section>
  )
}
