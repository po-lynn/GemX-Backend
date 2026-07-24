"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import type { HomepageFeaturedProduct } from "@/features/products/db/products"

const GemIcon = () => (
  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" opacity="0.4">
    <path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/>
  </svg>
)

const PhoneIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="2" width="14" height="20" rx="3"/><path d="M12 18h.01"/>
  </svg>
)

const PLACEHOLDER_GRADIENTS = [
  "linear-gradient(150deg,#ece8fb,#a896ee)",
  "linear-gradient(150deg,#fde8f0,#e07aab)",
  "linear-gradient(150deg,#e8f4fb,#7ab6e0)",
]

function formatPrice(price: string, currency: "USD" | "MMK") {
  const n = Number(price)
  if (currency === "USD") return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 0 })} MMK`
}

function productSub(p: HomepageFeaturedProduct): string {
  const parts: string[] = []
  if (p.certLabName) parts.push(p.certLabName + " certified")
  if (p.origin) parts.push(p.origin)
  if (p.weightCarat) parts.push(`${Number(p.weightCarat).toFixed(2)} ct`)
  if (p.categoryName) parts.push(p.categoryName)
  return parts.slice(0, 3).join(" · ") || "Certified · Premium quality"
}

interface Props {
  products: HomepageFeaturedProduct[]
}

export function OwnProductsSection({ products }: Props) {
  const [activeCategory, setActiveCategory] = useState("all")

  const categories = useMemo(() => {
    const names = Array.from(new Set(products.map((p) => p.categoryName).filter((n): n is string => !!n)))
    return [{ id: "all", label: "All picks" }, ...names.map((name) => ({ id: name, label: name }))]
  }, [products])

  const display = (activeCategory === "all" ? products : products.filter((p) => p.categoryName === activeCategory)).slice(0, 6)

  return (
    <section className="home-section-pad" style={{ padding: "80px 7vw 0" }}>
      <div style={{
        display: "flex", alignItems: "flex-end", justifyContent: "space-between",
        marginBottom: 20, gap: 16, flexWrap: "wrap",
      }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: "var(--font-bricolage)", fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em", color: "#171326" }}>
            Curated by GemX
          </h2>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: "#7b7593" }}>
            A taste of what&apos;s live in the app.
          </p>
        </div>
        <Link href="#app" style={{ fontSize: 14, fontWeight: 700, color: "#5B3DF5", textDecoration: "none", whiteSpace: "nowrap" }}>
          See all →
        </Link>
      </div>

      {categories.length > 1 && (
        <div className="home-scroll-row" style={{ display: "flex", gap: 9, overflowX: "auto", padding: "0 0 22px" }}>
          {categories.map((c) => {
            const active = c.id === activeCategory
            return (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className="home-chip"
                style={{
                  flex: "0 0 auto", cursor: "pointer", fontFamily: "inherit",
                  padding: "9px 16px", borderRadius: 99, fontSize: 13, fontWeight: active ? 700 : 600,
                  background: active ? "#171326" : "#fff",
                  color: active ? "#fff" : "#4a4560",
                  border: active ? "0" : "1px solid #e6e0f6",
                }}
              >{c.label}</button>
            )
          })}
        </div>
      )}

      <div className="home-featured-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24 }}>
        {display.length > 0 ? display.map((item, i) => {
          const gradient = PLACEHOLDER_GRADIENTS[i % PLACEHOLDER_GRADIENTS.length]
          const sub = productSub(item)
          return (
            <Link
              key={item.id}
              href="#app"
              className="home-card-hover home-product-card"
              style={{
                border: "1px solid #eee7fa", borderRadius: 22, overflow: "hidden",
                background: "#fff", boxShadow: "0 20px 40px -30px rgba(41,20,90,.3)", display: "block",
                textDecoration: "none",
              }}
            >
              <div style={{
                aspectRatio: "1/1", background: gradient,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", position: "relative", overflow: "hidden",
              }}>
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt={item.title}
                    fill
                    style={{ objectFit: "cover" }}
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                ) : (
                  <GemIcon />
                )}
                <span style={{
                  position: "absolute", top: 12, left: 12, fontSize: 11, fontWeight: 800,
                  color: "#5B3DF5", background: "rgba(255,255,255,.92)", padding: "5px 11px",
                  borderRadius: 99, zIndex: 1,
                }}>Own Pick</span>
                {item.isVerified && (
                  <span style={{
                    position: "absolute",
                    top: 44,
                    left: 12,
                    fontSize: 11,
                    fontWeight: 800,
                    color: "#12A374",
                    background: "rgba(255,255,255,.92)",
                    padding: "5px 11px",
                    borderRadius: 99,
                    zIndex: 1,
                  }}>GemX Verified</span>
                )}
              </div>
              <div style={{ padding: "16px" }}>
                <div style={{ fontFamily: "var(--font-bricolage)", fontSize: 17, fontWeight: 700, color: "#171326", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.title}</div>
                <div style={{ fontSize: 12, color: "#8b86a2", margin: "3px 0 12px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>
                <div style={{ fontFamily: "var(--font-bricolage)", fontSize: 19, fontWeight: 800, color: "#171326" }}>{formatPrice(item.price, item.currency)}</div>
                <span style={{
                  marginTop: 13, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  fontSize: 13, fontWeight: 700, color: "#fff",
                  background: "#171326", padding: "11px", borderRadius: 12,
                }}>
                  <PhoneIcon />View in app
                </span>
              </div>
            </Link>
          )
        }) : (
          [0, 1, 2].map((i) => (
            <div key={i} style={{
              border: "1px solid #eee7fa", borderRadius: 22, overflow: "hidden",
              background: "#fff", boxShadow: "0 1px 3px rgba(20,15,40,0.04)",
            }}>
              <div style={{ aspectRatio: "1/1", background: PLACEHOLDER_GRADIENTS[i], opacity: 0.5 }} />
              <div style={{ padding: "16px" }}>
                <div style={{ height: 20, width: "70%", borderRadius: 6, background: "#ededf2", marginBottom: 8 }} />
                <div style={{ height: 14, width: "50%", borderRadius: 4, background: "#f3f2f7" }} />
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
