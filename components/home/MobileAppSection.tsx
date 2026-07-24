export function MobileAppSection() {
  return (
    <section id="app" className="home-section-pad" style={{ padding: "80px 7vw 0" }}>
      <div className="home-app-inner home-app-grid" style={{
        borderRadius: 28, background: "linear-gradient(150deg,#241a55,#5B3DF5)",
        padding: 52, display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 44, alignItems: "center",
        color: "#fff", overflow: "hidden", position: "relative",
      }}>
        {/* Left: copy */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#c9bdff" }}>On the go</div>
          <h2 style={{
            margin: "10px 0 0", fontFamily: "var(--font-bricolage)", fontSize: 32,
            fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.1,
          }}>
            Buy, list &amp; manage from anywhere.
          </h2>
          <p style={{ margin: "14px 0 0", fontSize: 14.5, color: "#d9d1ff", lineHeight: 1.6, maxWidth: 430 }}>
            Browse certified stones, list your own pieces, and manage your store — all from your phone.
          </p>

          <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
            <span style={{
              flex: 1, display: "flex", alignItems: "center", gap: 9,
              background: "#000", borderRadius: 14, padding: "10px 12px", cursor: "default",
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff" style={{ flexShrink: 0 }}>
                <path d="M16.5 1.4c0 1.1-.4 2.1-1.2 3-.9 1-2 1.6-3.1 1.5-.1-1.1.4-2.2 1.1-3 .8-.9 2.1-1.5 3.2-1.5zM20 17.2c-.6 1.4-.9 2-1.7 3.2-1.1 1.7-2.7 3.8-4.6 3.8-1.7 0-2.1-1.1-4.4-1.1-2.3 0-2.8 1.1-4.4 1.1-1.9 0-3.4-1.9-4.5-3.6C-.2 17.4-.5 12 1.4 9.1 2.7 7 4.9 5.7 7 5.7c2 0 3.2 1.1 4.8 1.1 1.6 0 2.5-1.1 4.8-1.1 1.8 0 3.7 1 5.1 2.7-4.5 2.4-3.8 8.8.3 8.8z"/>
              </svg>
              <span>
                <span style={{ display: "block", fontSize: 9, color: "#fff", opacity: 0.7 }}>Download on the</span>
                <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#fff" }}>App Store</span>
              </span>
            </span>
            <span style={{
              flex: 1, display: "flex", alignItems: "center", gap: 9,
              background: "#000", borderRadius: 14, padding: "10px 12px", cursor: "default",
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="m3 3 16 9-16 9z"/>
              </svg>
              <span>
                <span style={{ display: "block", fontSize: 9, color: "#fff", opacity: 0.7 }}>Get it on</span>
                <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#fff" }}>Google Play</span>
              </span>
            </span>
          </div>
          <p style={{ margin: "16px 0 0", fontSize: 12, color: "#a99adf", maxWidth: 420 }}>
            Links go live when the app is published. Use the web admin to manage products in the meantime.
          </p>
        </div>

        {/* Right: phone mockup */}
        <div className="home-app-phone" style={{ display: "flex", justifyContent: "center" }}>
          <div style={{
            width: 236, height: 478, borderRadius: 40, background: "#171326",
            border: "9px solid #171326", boxShadow: "0 24px 50px rgba(15,10,35,0.4)",
            overflow: "hidden", position: "relative",
          }}>
            <div style={{
              position: "absolute", inset: 0, borderRadius: 31, overflow: "hidden",
              background: "#F7F5FF", display: "flex", flexDirection: "column",
            }}>
              {/* App bar */}
              <div style={{ background: "#fff", padding: "14px 16px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: 7,
                      background: "linear-gradient(135deg,#5B3DF5,#E8318A)",
                      display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13,
                    }}>◈</div>
                    <span style={{ fontFamily: "var(--font-bricolage)", fontSize: 15, fontWeight: 800, color: "#171326" }}>GemX</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      width: 24, height: 24, borderRadius: "50%", background: "#f1ecff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#5B3DF5" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                      </svg>
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#5B3DF5", background: "#f1ecff", padding: "4px 9px", borderRadius: 99 }}>Points</span>
                  </div>
                </div>
              </div>

              {/* Scroll body */}
              <div style={{ flex: 1, padding: 12, display: "flex", flexDirection: "column", gap: 11, overflow: "hidden" }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", color: "#171326" }}>Rare &amp; investment grade</div>
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
                  borderRadius: 14, background: "linear-gradient(135deg,#5B3DF5,#7C3AED)",
                  padding: 13, color: "#fff",
                }}>
                  <div style={{ fontSize: "11.5px", fontWeight: 800 }}>Tell us what you seek</div>
                  <div style={{ fontSize: "9.5px", color: "#efeaff", marginTop: 2, lineHeight: 1.4 }}>We source it within 72 hours.</div>
                  <div style={{ marginTop: 9, display: "inline-block", fontSize: "9.5px", fontWeight: 700, color: "#5B3DF5", background: "#fff", padding: "5px 12px", borderRadius: 99 }}>Start a deal</div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  {[
                    "linear-gradient(150deg,#f6c7d0,#d4677c)",
                    "linear-gradient(150deg,#cdeedd,#5bb98c)",
                  ].map((g, i) => (
                    <div key={i} style={{ flex: 1, borderRadius: 12, background: "#fff", border: "1px solid #eee7fa", overflow: "hidden" }}>
                      <div style={{ aspectRatio: "1/1", background: g }} />
                      <div style={{ padding: "7px 8px 9px" }}>
                        <div style={{ height: 6, width: "70%", borderRadius: 4, background: "#e7e5ee" }} />
                        <div style={{ height: 6, width: "45%", borderRadius: 4, background: "#f1ecff", marginTop: 5 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom nav */}
              <div style={{
                background: "#fff", borderTop: "1px solid #eee7fa",
                padding: "9px 22px 12px", display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#5B3DF5" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#b3aecf" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                <div style={{
                  width: 40, height: 40, borderRadius: "50%",
                  background: "linear-gradient(135deg,#5B3DF5,#E8318A)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 6px 14px rgba(91,61,245,0.4)", marginTop: -26,
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                </div>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#b3aecf" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#b3aecf" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>
              </div>
            </div>
            {/* Notch */}
            <div style={{
              position: "absolute", top: 9, left: "50%", transform: "translateX(-50%)",
              width: 74, height: 5, borderRadius: 5, background: "rgba(255,255,255,0.5)", zIndex: 2,
            }} />
          </div>
        </div>
      </div>
    </section>
  )
}
