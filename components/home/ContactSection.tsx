"use client"

import { useState, type FormEvent } from "react"

type SubmitState = "idle" | "submitting" | "success" | "error"

export function ContactSection() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [state, setState] = useState<SubmitState>("idle")
  const [errorMessage, setErrorMessage] = useState("")

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setState("submitting")
    setErrorMessage("")

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setErrorMessage(data.error ?? "Something went wrong. Please try again.")
        setState("error")
        return
      }

      setState("success")
      setName("")
      setEmail("")
      setMessage("")
    } catch {
      setErrorMessage("Something went wrong. Please try again.")
      setState("error")
    }
  }

  return (
    <section id="contact" className="home-section-pad" style={{ padding: "80px 7vw 0" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          fontSize: "11px", fontWeight: 700, color: "#12A374",
          background: "#e9f7f1", padding: "6px 12px", borderRadius: 99,
        }}>
          ● We&apos;re here to help
        </span>
        <h2 style={{ margin: "14px 0 0", fontFamily: "var(--font-bricolage)", fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em", color: "#171326" }}>Contact us</h2>
        <p style={{ margin: "12px 0 0", fontSize: 14, color: "#7b7593", lineHeight: 1.6 }}>
          Questions about a piece, sourcing a specific stone, or selling on GemX? Our team replies within one business day.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 24 }}>
          <input
            placeholder="Your name"
            className="home-contact-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{
              fontFamily: "inherit", fontSize: 14, color: "#171326",
              background: "#fff", border: "1px solid #e6e0f6", borderRadius: 12,
              padding: "13px 16px", outline: "none",
            }}
          />
          <input
            placeholder="Email"
            type="email"
            className="home-contact-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              fontFamily: "inherit", fontSize: 14, color: "#171326",
              background: "#fff", border: "1px solid #e6e0f6", borderRadius: 12,
              padding: "13px 16px", outline: "none",
            }}
          />
          <textarea
            placeholder="How can we help?"
            rows={3}
            className="home-contact-input"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            style={{
              fontFamily: "inherit", fontSize: 14, color: "#171326",
              background: "#fff", border: "1px solid #e6e0f6", borderRadius: 12,
              padding: "13px 16px", outline: "none", resize: "vertical",
            }}
          />
          <button
            type="submit"
            disabled={state === "submitting"}
            style={{
              fontSize: 15, fontWeight: 800, color: "#fff",
              background: "linear-gradient(90deg,#5B3DF5,#7C3AED)", border: "none", padding: "15px", borderRadius: 14,
              cursor: state === "submitting" ? "not-allowed" : "pointer", fontFamily: "inherit",
              boxShadow: "0 14px 30px -10px rgba(91,61,245,.55)",
              opacity: state === "submitting" ? 0.7 : 1,
            }}
          >
            {state === "submitting" ? "Sending…" : "Send message"}
          </button>
          {state === "success" && (
            <p style={{ margin: 0, fontSize: 13, color: "#12A374", fontWeight: 600 }}>
              Thanks — your message has been sent. We&apos;ll reply within one business day.
            </p>
          )}
          {state === "error" && (
            <p style={{ margin: 0, fontSize: 13, color: "#e03b3b", fontWeight: 600 }}>
              {errorMessage}
            </p>
          )}
        </form>

        <div className="home-contact-form-row" style={{ display: "flex", gap: 12, marginTop: 14 }}>
          <a href="mailto:hello@gemxpremium.com" style={{
            flex: 1, display: "flex", alignItems: "center", gap: 10,
            padding: "13px 15px", background: "#fff", border: "1px solid #eee7fa", borderRadius: 14, textDecoration: "none",
          }}>
            <span style={{
              width: 34, height: 34, borderRadius: 10, background: "#f1ecff",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5B3DF5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/>
              </svg>
            </span>
            <span>
              <span style={{ display: "block", fontSize: 11, color: "#8b86a2" }}>Email</span>
              {/* suppressHydrationWarning: CDN email obfuscation can rewrite this text before hydrate */}
              <span
                style={{ display: "block", fontSize: 15, fontWeight: 700, color: "#171326" }}
                suppressHydrationWarning
              >
                hello@gemxpremium.com
              </span>
            </span>
          </a>
          <div style={{
            flex: 1, display: "flex", alignItems: "center", gap: 10,
            padding: "13px 15px", background: "#fff", border: "1px solid #eee7fa", borderRadius: 14,
          }}>
            <span style={{
              width: 34, height: 34, borderRadius: 10, background: "#e9f7f1",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#12A374" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            </span>
            <span>
              <span style={{ display: "block", fontSize: 11, color: "#8b86a2" }}>WhatsApp &amp; phone</span>
              <span style={{ display: "block", fontSize: 15, fontWeight: 700, color: "#171326" }}>+95 9 000 000 000</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
